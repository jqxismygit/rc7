<template>
  <view class="ticket-refund-page">
    <cr7-nav-bar title="申请退票" fallback-url="/pages/my-tickets/my-tickets" />
    <scroll-view
      class="refund-scroll"
      scroll-y
      :style="{ paddingTop: navInsetPx + 'px', paddingBottom: '220rpx' }"
    >
      <!-- 活动主卡片 -->
      <view class="event-card-section">
        <view class="event-card card-dark">
          <image
            :src="ticket.eventCover || '/static/images/event-card.jpg'"
            mode="aspectFill"
            class="event-cover"
          />
          <view class="event-info-wrap">
            <view class="event-title-row">
              <text class="event-title">{{ ticket.eventName }}</text>
              <view class="official-tag">
                <text class="tag-text">{{
                  ticket.isThird ? "三方票" : "官方票"
                }}</text>
              </view>
            </view>
            <view class="event-meta-item">
              <sx-svg name="time" :width="24" :height="24" color="#ADADAD" />
              <text class="meta-text">{{ ticket.eventDate }}</text>
            </view>
            <view class="event-meta-item">
              <sx-svg
                name="location"
                :width="24"
                :height="24"
                color="#ADADAD"
              />
              <text class="meta-text">{{ ticket.eventLocation }}</text>
            </view>
            <view class="event-meta-item ticket-info">
              <sx-svg name="ticket" :width="24" :height="24" color="#ADADAD" />
              <text class="meta-text"
                >{{ ticket.ticketType }} 开场前48小时可退</text
              >
            </view>
          </view>
        </view>
      </view>

      <!-- 订单详情 -->
      <view class="order-detail-card card-dark">
        <view class="detail-row">
          <text class="detail-label">订单号</text>
          <text class="detail-value">{{ ticket.orderNo || ticket.id }}</text>
        </view>
        <view class="detail-row">
          <text class="detail-label">订单总额</text>
          <text class="detail-value"
            >¥ {{ formatPrice(getOrderAmount()) * 0.01 }}</text
          >
        </view>
        <view class="detail-row detail-row-last">
          <text class="detail-label">退款金额</text>
          <text class="detail-value refund-amount"
            >¥ {{ formatPrice(getRefundAmount()) * 0.01 }}</text
          >
        </view>
      </view>

      <!-- 退款方式 -->
      <view class="refund-method-section">
        <text class="section-title">退款方式</text>
        <view class="refund-method-card card-dark">
          <view class="method-left">
            <image
              class="pay-icon"
              src="/static/images/wechat.png"
              mode="aspectFill"
            />
            <view class="method-text">
              <text class="method-name">微信支付</text>
              <text class="method-desc">原路退回支付账号</text>
            </view>
          </view>
          <sx-svg name="success" :width="32" :height="32" color="#d8fc0f" />
        </view>
      </view>

      <!-- 温馨提示 -->
      <view class="tips-section">
        <view class="tips-header">
          <text class="info-icon">ⓘ</text>
          <text class="tips-title">温馨提示</text>
        </view>
        <view class="tips-card card-dark">
          <text class="tips-content"
            >申请提交后，退款将原路返回，预计1-3个工作日到账。请确保您的账户状态正常。</text
          >
        </view>
      </view>

      <view class="scroll-bottom-space" />
    </scroll-view>

    <!-- 底部提交栏 -->
    <view class="bottom-bar safe-area-bottom">
      <view class="bottom-bar-inner">
        <view class="amount-block">
          <text class="amount-label">退款总额</text>
          <text class="amount-value"
            >¥ {{ formatPrice(getRefundAmount()) * 0.01 }}</text
          >
        </view>
        <button
          class="submit-btn btn-gold"
          :loading="submitting"
          @click="openRefundConfirm"
        >
          立即提交
        </button>
      </view>
    </view>

    <refund-confirm-dialog
      :show="refundDialogVisible"
      :title="REFUND_CONFIRM_TITLE"
      :subtitle="REFUND_CONFIRM_SUBTITLE"
      :reason-options="REFUND_REASON_OPTIONS"
      @cancel="onRefundDialogCancel"
      @confirm="onRefundDialogConfirm"
    />
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import RefundConfirmDialog from "@/components/refund-confirm-dialog/refund-confirm-dialog.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { getOrderDetail } from "@/services/order.js";
import { initiateRefund } from "@/services/payment.js";
import request from "@/utils/request.js";
import { buildTicketDetailFromOrder } from "@/utils/orderDisplay.js";
import {
  REFUND_CONFIRM_SUBTITLE,
  REFUND_CONFIRM_TITLE,
  REFUND_REASON_OPTIONS,
} from "@/config/refund-reasons.js";

export default {
  components: {
    Cr7NavBar,
    RefundConfirmDialog,
  },

  data() {
    return {
      ticketId: "",
      ticket: {},
      submitting: false,
      navInsetPx: 0,
      refundDialogVisible: false,
      REFUND_CONFIRM_TITLE,
      REFUND_CONFIRM_SUBTITLE,
      REFUND_REASON_OPTIONS,
    };
  },

  onLoad(options) {
    this.navInsetPx = getNavBarInsetPx();
    this.ticketId = options.id;
    this.loadTicket();
  },

  methods: {
    async loadTicket() {
      if (!this.ticketId) {
        uni.showToast({
          title: "缺少票券ID",
          icon: "none",
        });
        return;
      }

      try {
        const order = await getOrderDetail(this.ticketId);
        let exhibition = null;
        try {
          exhibition = await request.get(
            `/exhibition/${encodeURIComponent(order.exhibit_id)}`,
          );
        } catch (e) {
          exhibition = null;
        }
        this.ticket = buildTicketDetailFromOrder(order, exhibition);
        console.log("ticket", this.ticket);
      } catch (e) {
        console.error("loadRefundTicket", e);
        uni.showToast({
          title: "票券不存在",
          icon: "none",
        });
        setTimeout(() => {
          uni.navigateBack();
        }, 800);
      }
    },

    getOrderAmount() {
      return this.ticket.paidAmount ?? this.ticket.price ?? 0;
    },

    getRefundAmount() {
      return this.ticket.refundAmount ?? this.ticket.price ?? 0;
    },

    formatPrice(price) {
      if (!price && price !== 0) return "0.00";
      return Number(price)
        .toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    openRefundConfirm() {
      if (this.submitting) return;
      if (!this.ticket?.id) {
        uni.showToast({ title: "票券数据异常", icon: "none" });
        return;
      }
      this.refundDialogVisible = true;
    },

    onRefundDialogCancel() {
      this.refundDialogVisible = false;
    },

    onRefundDialogConfirm({ value }) {
      this.refundDialogVisible = false;
      this.submitRefund(value);
    },

    async submitRefund(reason) {
      if (this.submitting) return;
      if (!this.ticket?.id) {
        uni.showToast({ title: "票券数据异常", icon: "none" });
        return;
      }
      this.submitting = true;
      try {
        await initiateRefund(this.ticket.id, { reason });
        this.ticket.status = "refunding";
        uni.showModal({
          title: "退票成功",
          content: "退款已发起，预计1-3个工作日内退回至微信支付账户。",
          showCancel: false,
          success: () => {
            uni.switchTab({
              url: "/pages/my-tickets/my-tickets",
            });
          },
        });
      } catch (e) {
        const msg =
          (e && e.data && e.data.message) || "退票失败，请联系客服协助处理。";
        uni.showModal({
          title: "退票失败",
          content: msg,
          showCancel: false,
        });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.ticket-refund-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.refund-scroll {
  height: 100vh;
  padding: 0 30rpx;
}

/* ===== 活动主卡片 ===== */
.event-card-section {
  padding: 30rpx 0 24rpx;
}

.event-card {
  overflow: hidden;
}

.event-cover {
  width: 100%;
  height: 387rpx;
}

.event-info-wrap {
  padding: 24rpx 30rpx 30rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.event-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.event-title {
  flex: 1;
  font-size: 34rpx;
  color: $text-white;
  font-weight: 500;
  font-family: "PingFang SC", sans-serif;
  letter-spacing: -1rpx;
  line-height: 1.5;
}

.official-tag {
  flex-shrink: 0;
  padding: 8rpx 24rpx;
  background: rgba(234, 179, 8, 0.2);
  border-radius: 999rpx;
}

.tag-text {
  font-size: 24rpx;
  font-weight: 700;
  color: $cr7-gold;
  text-transform: uppercase;
}

.event-meta-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.meta-icon {
  font-size: 22rpx;
  width: 28rpx;
  text-align: center;
}

.meta-text {
  font-size: 26rpx;
  color: $text-light;
  line-height: 26rpx;
}

/* ===== 订单详情 ===== */
.order-detail-card {
  padding: 30rpx;
  margin-bottom: 24rpx;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 0;
  border-bottom: 1rpx solid rgba(42, 42, 42, 0.6);
}

.detail-row-last {
  border-bottom: none;
}

.detail-label {
  font-size: $font-base;
  color: $text-light;
  font-weight: 500;
}

.detail-value {
  font-size: $font-base;
  color: $text-white;
  font-weight: 500;
}

.detail-value.refund-amount {
  color: $cr7-gold;
  font-weight: 700;
}

/* ===== 退款方式 ===== */
.refund-method-section {
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 38rpx;
  font-weight: 400;
  color: $text-white;
  letter-spacing: -1rpx;
  line-height: 1.2;
  display: block;
  margin-bottom: 24rpx;
}

.refund-method-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
}

.method-left {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.wechat-icon-wrap {
  width: 62rpx;
  height: 62rpx;
  background: #07c160;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wechat-char {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
}

.method-text {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.method-name {
  font-size: 30rpx;
  font-weight: 500;
  color: $text-white;
}

.method-desc {
  font-size: 24rpx;
  color: $text-disabled;
}

.method-check {
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  background: $cr7-gold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-icon {
  font-size: 20rpx;
  color: $cr7-black;
  font-weight: 700;
}

/* ===== 温馨提示 ===== */
.tips-section {
  margin-bottom: 40rpx;
}

.tips-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.info-icon {
  font-size: 28rpx;
  color: $text-white;
}

.tips-title {
  font-size: 30rpx;
  font-weight: 500;
  color: $text-white;
}

.tips-card {
  padding: 30rpx;
}

.tips-content {
  font-size: 26rpx;
  color: $text-light;
  line-height: 1.7;
}

.scroll-bottom-space {
  height: 40rpx;
}

/* ===== 底部提交栏 ===== */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: $cr7-dark;
  border-top: 1rpx solid $cr7-border;
  backdrop-filter: blur(12px);
  padding: 30rpx;
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
}

.bottom-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30rpx;
}

.amount-block {
  display: flex;
  flex-direction: column;
}

.amount-label {
  font-size: 24rpx;
  color: $text-light;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.amount-value {
  font-size: 46rpx;
  font-weight: 700;
  color: $cr7-gold;
  line-height: 1.3;
}

.submit-btn {
  flex: 1;
  max-width: 518rpx;
  height: 98rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn::after {
  border: none;
}

.pay-icon {
  width: 62rpx;
  height: 62rpx;
  // border-radius: 12rpx;
}
</style>
