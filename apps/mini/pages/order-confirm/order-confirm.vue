<template>
  <view class="order-page">
    <view class="nav-bar safe-area-top">
      <view class="nav-back" @click="goBack">
        <text class="nav-back-icon">‹</text>
      </view>
      <text class="nav-title">订单确认</text>
      <view class="nav-placeholder"></view>
    </view>

    <view v-if="loading" class="state-wrap">
      <text class="state-text">加载订单中...</text>
    </view>

    <view v-else-if="loadError" class="state-wrap">
      <text class="state-text">{{ loadError }}</text>
      <button v-if="orderId" class="btn-retry" @click="loadOrderDetail">
        重试
      </button>
    </view>

    <scroll-view v-else class="order-scroll" scroll-y>
      <view class="section section-title-block">
        <text class="order-title">{{ eventTitle }}</text>
        <text v-if="statusLabel" class="order-status">{{ statusLabel }}</text>
        <text v-if="expireHint" class="order-expire">{{ expireHint }}</text>
      </view>

      <view class="section">
        <view class="ticket-card card-dark">
          <view class="ticket-card-main">
            <text class="museum-address">{{ museumLocation }}</text>
            <text class="valid-text">有效期：{{ validDateText }}</text>
            <view
              v-for="line in displayLines"
              :key="line.id"
              class="ticket-line-row"
            >
              <text class="ticket-line-name"
                >{{ line.name }} × {{ line.quantity }}</text
              >
              <text class="ticket-line-price">¥{{ formatMoney(line.subtotal) }}</text>
            </view>
            <view class="ticket-meta-row">
              <text class="ticket-meta">共 {{ totalTicketCount }} 张</text>
            </view>
          </view>
          <image
            class="ticket-cover"
            :src="coverSrc"
            mode="aspectFill"
          />
        </view>
      </view>

      <view class="section">
        <text class="section-title">预约详情</text>
        <view class="detail-row">
          <view class="detail-left">
            <text class="detail-icon">⚠️</text>
            <text class="detail-label">不支持退</text>
          </view>
          <text class="detail-value">电子票、电子发票</text>
        </view>
        <view class="detail-row">
          <view class="detail-left">
            <text class="detail-icon">📱</text>
            <text class="detail-label">联系电话</text>
          </view>
          <text class="detail-value">{{ contactPhone }}</text>
        </view>
        <view class="detail-row">
          <view class="detail-left">
            <text class="detail-icon">🚚</text>
            <text class="detail-label">配送方式</text>
          </view>
          <text class="detail-value">直接入场</text>
        </view>
        <view class="detail-tip-row">
          <text class="detail-tip">
            支付成功后，无需取票，前往票夹查看入场凭证
          </text>
        </view>
      </view>

      <view class="divider-line"></view>

      <view class="section">
        <text class="section-title">支付方式</text>
        <view class="pay-method card-dark">
          <view class="pay-left">
            <view class="pay-icon-wrap">
              <image
                class="pay-icon"
                src="/static/images/wechat-pay.png"
                mode="aspectFill"
              />
            </view>
            <text class="pay-name">微信支付</text>
          </view>
          <text class="pay-checked">✔</text>
        </view>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>

    <view
      v-if="!loading && !loadError"
      class="footer-wrap safe-area-bottom"
    >
      <view class="footer-inner">
        <view class="footer-total">
          <text class="total-label">总额</text>
          <text class="total-value">¥ {{ footerAmount }}</text>
        </view>
        <view class="bottom-bar">
          <button
            class="btn-gold pay-btn"
            :disabled="!canPay"
            @click="handlePay"
          >
            立即支付
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getOrderDetail, ORDER_CONFIRM_CONTEXT_KEY } from "@/services/order.js";
import { useUserStore } from "@/stores/user.js";

const STATUS_LABEL = {
  PENDING_PAYMENT: "待支付",
  PAID: "已支付",
  CANCELLED: "已取消",
  EXPIRED: "已过期",
};

export default {
  data() {
    return {
      loading: true,
      loadError: "",
      orderId: "",
      order: null,
      /** 购票页写入：{ ticketEvent, ticketTypes, visitDate } */
      sectionCtx: null,
      /** 无 orderId 时的旧版 URL 参数模式 */
      legacyOrder: null,
    };
  },

  computed: {
    eventTitle() {
      if (this.legacyOrder) {
        return (
          this.legacyOrder.eventName || "C罗博物馆 CR7LIFE上海博物馆门票"
        );
      }
      const t = this.sectionCtx?.ticketEvent?.title;
      return t || "C罗博物馆 CR7LIFE上海博物馆门票";
    },
    museumLocation() {
      if (this.legacyOrder) {
        return (
          this.legacyOrder.museumLocation || "上海市黄浦区王府井大街123号"
        );
      }
      return (
        this.sectionCtx?.ticketEvent?.location ||
        "上海市黄浦区王府井大街123号"
      );
    },
    coverSrc() {
      if (this.legacyOrder) return "/static/images/event-card.jpg";
      return (
        this.sectionCtx?.ticketEvent?.cover || "/static/images/event-card.jpg"
      );
    },
    validDateText() {
      if (this.legacyOrder) {
        return (
          this.legacyOrder.validDate ||
          this.legacyOrder.visitDate ||
          "2026.02.28"
        );
      }
      const v = this.sectionCtx?.visitDate;
      if (v) return v;
      const sd = this.sectionCtx?.ticketEvent?.session_date;
      if (sd) return String(sd).slice(0, 10);
      return "—";
    },
    contactPhone() {
      if (this.legacyOrder) {
        return this.legacyOrder.phone || "+86 138 0000 0000";
      }
      const p = this.sectionCtx?.ticketEvent?.contact_phone;
      if (p) return p;
      const store = useUserStore();
      return store.profile?.phone || "+86 138 0000 0000";
    },
    statusLabel() {
      if (this.legacyOrder || !this.order) return "";
      return STATUS_LABEL[this.order.status] || this.order.status;
    },
    expireHint() {
      if (!this.order || this.order.status !== "PENDING_PAYMENT") return "";
      const raw = this.order.expires_at;
      if (!raw) return "";
      const d = new Date(String(raw).replace(/-/g, "/"));
      if (Number.isNaN(d.getTime())) return "";
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `请在 ${hh}:${mm} 前完成支付`;
    },
    nameByCategoryId() {
      const map = {};
      const rows = this.sectionCtx?.ticketTypes;
      if (Array.isArray(rows)) {
        rows.forEach((t) => {
          if (t && t.id != null) map[String(t.id)] = t.name || "门票";
        });
      }
      return map;
    },
    displayLines() {
      if (this.legacyOrder) {
        return [
          {
            id: "legacy",
            name: this.legacyOrder.ticketName || "门票",
            quantity: this.legacyOrder.quantity || 1,
            subtotal: Number(this.legacyOrder.amount) || 0,
          },
        ];
      }
      if (!this.order?.items?.length) return [];
      return this.order.items.map((it) => ({
        id: it.id,
        name:
          this.nameByCategoryId[String(it.ticket_category_id)] || "门票",
        quantity: it.quantity,
        subtotal: it.subtotal,
      }));
    },
    totalTicketCount() {
      return this.displayLines.reduce((s, l) => s + (l.quantity || 0), 0);
    },
    footerAmount() {
      if (this.legacyOrder) {
        const a = this.legacyOrder.amount;
        return typeof a === "number" ? a.toFixed(2) : String(a || "0.00");
      }
      if (!this.order) return "0.00";
      return this.formatMoney(this.order.total_amount);
    },
    canPay() {
      if (this.legacyOrder) return true;
      return this.order?.status === "PENDING_PAYMENT";
    },
  },

  onLoad(options) {
    const oid = options.orderId
      ? decodeURIComponent(options.orderId)
      : "";

    if (oid) {
      this.orderId = oid;
      try {
        this.sectionCtx = uni.getStorageSync(ORDER_CONFIRM_CONTEXT_KEY) || null;
      } catch (e) {
        this.sectionCtx = null;
      }
      try {
        uni.removeStorageSync(ORDER_CONFIRM_CONTEXT_KEY);
      } catch (e) {
        /* ignore */
      }
      this.loadOrderDetail();
      return;
    }

    this.loading = false;
    this.legacyOrder = {
      eventName:
        decodeURIComponent(options.eventName || "") ||
        "C罗博物馆 CR7LIFE上海博物馆门票",
      museumLocation:
        decodeURIComponent(options.museumLocation || "") ||
        "上海市黄浦区王府井大街123号",
      visitDate: options.visitDate || "",
      ticketName: decodeURIComponent(options.ticketName || ""),
      quantity: Number(options.quantity || 1),
      amount: options.amount || "125.00",
      phone: options.phone || "+86 138 0000 0000",
    };
  },

  methods: {
    formatMoney(n) {
      if (n == null || n === "") return "0.00";
      const num = Number(n);
      if (Number.isNaN(num)) return String(n);
      return num.toFixed(2);
    },

    async loadOrderDetail() {
      this.loading = true;
      this.loadError = "";
      try {
        const data = await getOrderDetail(this.orderId);
        this.order = data;
        this.loading = false;
      } catch (e) {
        this.loading = false;
        this.loadError = "订单加载失败，请返回重试";
        console.error("getOrderDetail", e);
      }
    },

    goBack() {
      if (getCurrentPages().length > 1) {
        uni.navigateBack();
      } else {
        uni.switchTab({ url: "/pages/index/index" });
      }
    },

    handlePay() {
      if (!this.canPay) {
        uni.showToast({ title: "当前订单不可支付", icon: "none" });
        return;
      }
      uni.showLoading({ title: "发起支付..." });
      setTimeout(() => {
        uni.hideLoading();
        uni.showToast({ title: "支付成功", icon: "success" });
        setTimeout(() => {
          uni.switchTab({ url: "/pages/my-tickets/my-tickets" });
        }, 1500);
      }, 1500);
    },
  },
};
</script>

<style lang="scss" scoped>
.order-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
  position: relative;
}

.state-wrap {
  padding: 280rpx 48rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.state-text {
  font-size: 28rpx;
  color: $text-muted;
  text-align: center;
}

.btn-retry {
  margin-top: 32rpx;
  font-size: 28rpx;
  color: $cr7-black;
  background: $cr7-gold;
  border-radius: $radius-md;
  padding: 16rpx 48rpx;
}

.order-scroll {
  width: 100%;
  height: 100vh;
  padding-top: 196rpx;
}

.nav-bar {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  padding: 0 $spacing-lg;
  padding-top: 56rpx;
  height: 196rpx;
  display: flex;
  align-items: center;
  z-index: 20;
  background: $cr7-black;
}

.nav-back {
  width: 70rpx;
  height: 70rpx;
  border-radius: 40rpx;
  background: $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-back-icon {
  color: $text-white;
  font-size: 40rpx;
  margin-top: -4rpx;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  color: $text-white;
  font-weight: 700;
}

.nav-placeholder {
  width: 70rpx;
  height: 70rpx;
}

.section {
  padding: 0 30rpx;
}

.section-title-block {
  margin-top: 32rpx;
  margin-bottom: 24rpx;
}

.order-title {
  font-size: 38rpx;
  color: $text-white;
  font-weight: 500;
  line-height: 48rpx;
}

.order-status {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: $cr7-gold;
}

.order-expire {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: $text-muted;
}

.card-dark {
  background: $cr7-dark;
  border-radius: $radius-lg;
}

.ticket-card {
  margin-bottom: 32rpx;
  padding: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ticket-card-main {
  flex: 1;
  padding-right: 24rpx;
}

.museum-address {
  font-size: 30rpx;
  color: $text-white;
  line-height: 40rpx;
}

.valid-text {
  margin-top: 8rpx;
  font-size: 26rpx;
  color: $cr7-gold;
}

.ticket-line-row {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket-line-name {
  flex: 1;
  font-size: 26rpx;
  color: $text-white;
  padding-right: 16rpx;
}

.ticket-line-price {
  font-size: 26rpx;
  color: $cr7-gold;
}

.ticket-meta-row {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
}

.ticket-meta {
  font-size: 24rpx;
  color: $text-muted;
}

.ticket-cover {
  width: 246rpx;
  height: 184rpx;
  border-radius: 16rpx;
}

.section-title {
  display: block;
  font-size: 38rpx;
  color: $text-white;
  font-weight: 400;
  margin-bottom: 24rpx;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.detail-left {
  display: flex;
  align-items: center;
}

.detail-icon {
  font-size: 24rpx;
  color: $cr7-gold;
  margin-right: 16rpx;
}

.detail-label {
  font-size: 26rpx;
  color: $text-disabled;
}

.detail-value {
  font-size: 26rpx;
  color: $text-white;
}

.detail-tip-row {
  margin-top: 10rpx;
  display: flex;
  justify-content: flex-end;
}

.detail-tip {
  font-size: 24rpx;
  color: $text-muted;
  line-height: 38rpx;
}

.divider-line {
  height: 2rpx;
  margin: 65rpx 30rpx 58rpx 30rpx;
  background: $cr7-card;
}

.pay-method {
  margin-top: 16rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pay-left {
  display: flex;
  align-items: center;
}

.pay-icon-wrap {
  width: 62rpx;
  height: 62rpx;
  border-radius: 12rpx;
  background: $cr7-card;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.pay-icon {
  width: 58rpx;
  height: 58rpx;
  border-radius: 10rpx;
}

.pay-name {
  font-size: 30rpx;
  color: $text-white;
}

.pay-checked {
  font-size: 32rpx;
  color: $cr7-gold;
}

.total-label {
  font-size: 30rpx;
  color: $text-muted;
}

.total-value {
  font-size: 38rpx;
  color: $cr7-gold;
  font-weight: 700;
}

.safe-bottom {
  height: 160rpx;
}

.footer-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  border-top: 1rpx solid $cr7-border;
  background: $cr7-dark;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15rpx 30rpx 12rpx;
}

.footer-total {
  display: flex;
  flex-direction: column;
}

.bottom-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pay-btn {
  width: 518rpx;
  height: 98rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: $cr7-black;
}

.pay-btn[disabled] {
  opacity: 0.45;
}
</style>
