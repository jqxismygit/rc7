<template>
  <view class="payment-bridge-page">
    <cr7-nav-bar
      title="支付处理中"
      fallback-url="/pages/game/game"
      :show-back="true"
    />
    <view class="bridge-body" :style="{ paddingTop: navInsetPx + 'px' }">
      <view class="bridge-card">
        <text class="bridge-title">{{ statusTitle }}</text>
        <text class="bridge-desc">{{ statusDesc }}</text>

        <view class="bridge-meta">
          <text class="bridge-meta-item"
            >订单号：{{ paymentPayload.orderId || "-" }}</text
          >
          <text class="bridge-meta-item"
            >支付金额：{{ paymentPayload.amount || "-" }} 元</text
          >
        </view>

        <button
          v-if="status === 'fail' || status === 'cancel'"
          class="bridge-btn"
          :disabled="busy"
          @click="startPayment"
        >
          重新发起支付
        </button>

        <button
          v-if="canReturn"
          class="bridge-btn bridge-btn-secondary"
          @click="returnToH5"
        >
          返回支付页
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { initiateWechatPay } from "@/services/payment.js";

export default {
  components: { Cr7NavBar },
  data() {
    return {
      navInsetPx: 0,
      busy: false,
      redirected: false,
      pageTitle: "互动",
      status: "processing",
      resultMessage: "正在拉起微信支付，请稍候",
      paymentPayload: {
        requestId: "",
        orderId: "",
        amount: "",
        subject: "",
        redirectUrl: "",
      },
    };
  },
  computed: {
    statusTitle() {
      if (this.status === "success") return "支付成功";
      if (this.status === "cancel") return "已取消支付";
      if (this.status === "fail") return "支付失败";
      return "支付处理中";
    },
    statusDesc() {
      return this.resultMessage;
    },
    canReturn() {
      return !!this.paymentPayload.redirectUrl;
    },
  },
  onLoad(options) {
    console.log("options====================>>>", options);
    this.navInsetPx = getNavBarInsetPx();
    this.paymentPayload = this.normalizeOptions(options);
    if (options.title) {
      this.pageTitle = this.decodeOption(options.title);
    }

    if (!this.paymentPayload.redirectUrl) {
      this.status = "fail";
      this.resultMessage = "缺少回跳地址，无法继续支付";
      return;
    }

    this.startPayment();
  },
  methods: {
    decodeOption(value) {
      if (value == null) return "";
      return decodeURIComponent(String(value).trim());
    },

    normalizeOptions(options) {
      const source = options || {};
      return {
        requestId: this.decodeOption(source.requestId),
        orderId: this.decodeOption(source.orderId),
        amount: this.decodeOption(source.amount),
        subject: this.decodeOption(source.subject),
        redirectUrl: this.decodeOption(source.redirectUrl),
      };
    },

    async startPayment() {
      if (this.busy) return;
      this.busy = true;
      this.redirected = false;
      this.status = "processing";
      this.resultMessage = "正在拉起微信支付，请稍候";

      let result = {
        status: "fail",
        message: "支付失败，请重试",
      };

      try {
        uni.showLoading({ title: "发起支付...", mask: true });
        const payParams = await this.resolveWechatPayParams(
          this.paymentPayload,
        );
        uni.hideLoading();
        await this.requestWechatPayment(payParams);

        this.status = "success";
        this.resultMessage = "支付成功，正在返回支付页";
        result = {
          status: "success",
          message: "支付成功",
        };
        uni.showToast({ title: "支付成功", icon: "success" });
      } catch (err) {
        uni.hideLoading();
        if (this.isUserCancelPayment(err)) {
          this.status = "cancel";
          this.resultMessage = "已取消支付，你可以重新发起或手动返回支付页";
          result = {
            status: "cancel",
            message: "用户取消支付",
          };
          uni.showToast({ title: "已取消支付", icon: "none" });
        } else {
          console.error("payment-bridge startPayment", err);
          const errorMessage =
            String(err?.message || "").trim() || "支付失败，请重试";
          this.status = "fail";
          this.resultMessage = `${errorMessage}，请重试或手动返回支付页`;
          result = {
            status: "fail",
            message: errorMessage,
          };
          uni.showToast({ title: errorMessage, icon: "none" });
        }
      } finally {
        this.busy = false;
        this.scheduleReturn(result);
      }
    },

    async resolveWechatPayParams(payload) {
      if (!payload.orderId) {
        throw new Error("缺少订单号，无法发起支付");
      }
      if (/^demo_/i.test(String(payload.orderId))) {
        throw new Error("当前是演示订单，未接入真实支付");
      }
      return await initiateWechatPay(payload.orderId);
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

    isUserCancelPayment(err) {
      const msg = String(err?.errMsg || err?.message || "");
      return /cancel|取消/i.test(msg);
    },

    scheduleReturn(result) {
      if (!this.paymentPayload.redirectUrl || this.redirected) return;
      if (result.status !== "success") return;
      const delay = 900;
      setTimeout(() => {
        this.returnToH5(result);
      }, delay);
    },

    returnToH5(result) {
      if (!this.paymentPayload.redirectUrl || this.redirected) return;
      this.redirected = true;

      const nextUrl = this.buildRedirectUrl(
        this.paymentPayload,
        result || {
          status: this.status,
          message: this.resultMessage,
        },
      );

      uni.redirectTo({
        url:
          `/pages/game/game-detail?url=${encodeURIComponent(nextUrl)}` +
          `&title=${encodeURIComponent(this.pageTitle)}`,
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
.payment-bridge-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.bridge-body {
  min-height: 100vh;
  box-sizing: border-box;
  padding-left: 32rpx;
  padding-right: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bridge-card {
  width: 100%;
  padding: 40rpx 32rpx;
  border-radius: 24rpx;
  background: #161616;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  box-sizing: border-box;
}

.bridge-title {
  display: block;
  font-size: 36rpx;
  line-height: 1.4;
  font-weight: 600;
  color: $text-white;
}

.bridge-desc {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: $text-muted;
}

.bridge-meta {
  margin-top: 32rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.bridge-meta-item {
  font-size: 24rpx;
  line-height: 1.6;
  color: $text-white;
  word-break: break-all;
}

.bridge-btn {
  margin-top: 28rpx;
  width: 100%;
  height: 88rpx;
  border-radius: 999rpx;
  border: none;
  background: $cr7-gold;
  color: #111111;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 88rpx;
}

.bridge-btn::after {
  border: none;
}

.bridge-btn-secondary {
  margin-top: 20rpx;
  background: transparent;
  color: $text-white;
  border: 1rpx solid rgba(255, 255, 255, 0.18);
}
</style>
