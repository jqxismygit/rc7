<template>
  <view class="game-detail-page">
    <cr7-nav-bar
      :title="pageTitle"
      fallback-url="/pages/game/game"
      :show-back="true"
    />
    <view class="web-view-wrap" :style="{ top: navInsetPx + 'px' }">
      <web-view
        v-if="h5Url"
        class="game-web-view"
        :src="h5Url"
        @message="onWebViewMessage"
      />
      <view v-else class="empty">
        <text class="empty-text">未配置 H5 地址</text>
        <text class="empty-hint"
          >请在 apps/mini/config/game-h5-url.js 中设置 DEFAULT_GAME_H5_URL</text
        >
        <text class="empty-hint">或从互动页以 ?url= 参数传入</text>
      </view>
    </view>
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { DEFAULT_GAME_H5_URL } from "@/config/game-h5-url.js";
import { initiateWechatPay } from "@/services/payment.js";
import {
  appendUserQueryToH5Url,
  mergeUserForH5,
  pickUserFromStore,
} from "@/utils/gameH5User.js";

export default {
  components: { Cr7NavBar },
  data() {
    return {
      navInsetPx: 0,
      h5Url: "",
      pageTitle: "互动",
      paymentPending: false,
      lastPaymentRequestId: "",
    };
  },
  onLoad(options) {
    this.navInsetPx = getNavBarInsetPx();
    const fromQuery = options.url
      ? decodeURIComponent(String(options.url).trim())
      : "";
    const base = (fromQuery || DEFAULT_GAME_H5_URL || "").trim();
    const user = mergeUserForH5(options, pickUserFromStore());
    this.h5Url = appendUserQueryToH5Url(base, user);
    if (options.title) {
      this.pageTitle = decodeURIComponent(String(options.title).trim());
    }
  },
  methods: {
    async onWebViewMessage(event) {
      const payload = this.extractPaymentPayload(event);
      console.log("payload====================>>>", payload);
      if (!payload || !payload.redirectUrl) return;
      if (payload.requestId && payload.requestId === this.lastPaymentRequestId)
        return;
      if (this.paymentPending) return;

      this.lastPaymentRequestId =
        payload.requestId || `payreq_${Date.now().toString(36)}`;
      this.paymentPending = true;

      let result = {
        status: "fail",
        message: "支付失败，请重试",
      };

      try {
        uni.showLoading({ title: "发起支付...", mask: true });
        const payParams = await this.resolveWechatPayParams(payload);
        uni.hideLoading();

        if (payParams) {
          await this.requestWechatPayment(payParams);
        } else {
          await this.runMockPayment(payload);
        }

        result = {
          status: "success",
          message: "支付成功",
        };
        uni.showToast({ title: "支付成功", icon: "success" });
      } catch (err) {
        uni.hideLoading();
        if (this.isUserCancelPayment(err)) {
          result = {
            status: "cancel",
            message: "用户取消支付",
          };
          uni.showToast({ title: "已取消支付", icon: "none" });
        } else {
          console.error("onWebViewMessage payment", err);
          result = {
            status: "fail",
            message: "支付失败，请重试",
          };
          uni.showToast({ title: "支付失败，请重试", icon: "none" });
        }
      } finally {
        this.paymentPending = false;
        this.reloadRedirectUrl(payload, result);
      }
    },

    extractPaymentPayload(event) {
      const source = event?.detail?.data;
      const list = Array.isArray(source) ? source.slice().reverse() : [source];
      for (const item of list) {
        const payload = this.normalizePaymentPayload(item);
        if (payload) return payload;
      }
      return null;
    },

    normalizePaymentPayload(raw) {
      if (!raw) return null;
      if (Array.isArray(raw)) {
        for (let i = raw.length - 1; i >= 0; i -= 1) {
          const payload = this.normalizePaymentPayload(raw[i]);
          if (payload) return payload;
        }
        return null;
      }
      if (typeof raw === "string") {
        try {
          return this.normalizePaymentPayload(JSON.parse(raw));
        } catch (err) {
          return null;
        }
      }
      if (typeof raw !== "object") return null;
      if (raw.type === "CR7_MINIAPP_PAYMENT_REQUEST") {
        return raw.payload || raw;
      }
      if (raw.data) return this.normalizePaymentPayload(raw.data);
      if (raw.payload) return this.normalizePaymentPayload(raw.payload);
      return null;
    },

    async resolveWechatPayParams(payload) {
      const params = payload.paymentParams;
      if (
        params &&
        params.timeStamp &&
        params.nonceStr &&
        params.package &&
        params.signType &&
        params.paySign
      ) {
        return params;
      }
      if (payload.orderId) {
        try {
          return await initiateWechatPay(payload.orderId);
        } catch (err) {
          console.warn("initiateWechatPay fallback to mock", err);
        }
      }
      return null;
    },

    requestWechatPayment(payParams) {
      return new Promise((resolve, reject) => {
        uni.requestPayment({
          provider: "wxpay",
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType,
          paySign: payParams.paySign,
          success: () => resolve(),
          fail: (err) => reject(err),
        });
      });
    },

    runMockPayment(payload) {
      return new Promise((resolve, reject) => {
        uni.showModal({
          title: "演示支付",
          content: `订单 ${payload.orderId || "-"}\n金额 ${payload.amount || "-"} 元`,
          confirmText: "支付成功",
          cancelText: "取消",
          success: (res) => {
            if (res.confirm) {
              resolve();
              return;
            }
            reject({ errMsg: "requestPayment:fail cancel" });
          },
          fail: (err) => reject(err),
        });
      });
    },

    isUserCancelPayment(err) {
      const msg = String(err?.errMsg || err?.message || "");
      return /cancel|取消/i.test(msg);
    },

    reloadRedirectUrl(payload, result) {
      const nextUrl = this.buildRedirectUrl(payload, result);
      if (!nextUrl) return;
      this.h5Url = "";
      this.$nextTick(() => {
        this.h5Url = nextUrl;
      });
    },

    buildRedirectUrl(payload, result) {
      const rawUrl = String(payload.redirectUrl || "").trim();
      if (!rawUrl) return "";

      const hashIndex = rawUrl.indexOf("#");
      const base = hashIndex >= 0 ? rawUrl.slice(0, hashIndex) : rawUrl;
      const hash = hashIndex >= 0 ? rawUrl.slice(hashIndex) : "";
      const queryIndex = base.indexOf("?");
      const path = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
      const queryString = queryIndex >= 0 ? base.slice(queryIndex + 1) : "";
      const query = this.parseQueryString(queryString);

      query.amount = payload.amount || query.amount || "";
      query.orderId = payload.orderId || query.orderId || "";
      query.payStatus = result.status;
      query.payMessage = result.message;
      query.paidAt = new Date().toISOString();

      const mergedQuery = this.stringifyQuery(query);
      return `${path}${mergedQuery ? `?${mergedQuery}` : ""}${hash}`;
    },

    parseQueryString(queryString) {
      const query = {};
      if (!queryString) return query;
      queryString.split("&").forEach((item) => {
        if (!item) return;
        const [rawKey, ...rest] = item.split("=");
        const key = decodeURIComponent(rawKey || "").trim();
        if (!key) return;
        query[key] = decodeURIComponent(rest.join("=") || "");
      });
      return query;
    },

    stringifyQuery(query) {
      return Object.keys(query)
        .filter((key) => query[key] != null && String(query[key]).trim() !== "")
        .map(
          (key) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`,
        )
        .join("&");
    },
  },
};
</script>

<style lang="scss" scoped>
.game-detail-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.web-view-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: $cr7-black;
}

.game-web-view {
  width: 100%;
  height: 100%;
}

.empty {
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.empty-text {
  font-size: 30rpx;
  color: $text-white;
  font-weight: 600;
}

.empty-hint {
  font-size: 24rpx;
  color: $text-muted;
  line-height: 1.5;
}
</style>
