<template>
  <view class="ticket-refund-page">
    <scroll-view class="refund-scroll" scroll-y>
      <!-- 顶部订单概览 -->
      <view class="order-card card-dark">
        <view class="order-header">
          <view class="thumb-placeholder">
            <text class="thumb-text">CR7</text>
          </view>
          <view class="order-main">
            <text class="event-name">{{ ticket.eventName }}</text>
            <text class="ticket-line">
              {{ ticket.ticketType }} × {{ ticket.quantity }} 张
            </text>
            <text class="event-date">参展时间：{{ ticket.eventDate }}</text>
          </view>
          <view class="order-tag">
            <text class="tag-text">
              {{ ticket.isThird ? '三方票' : '官方票' }}
            </text>
          </view>
        </view>

        <view class="rule-pill">
          开展前48小时可退 · 逾期不可退
        </view>
      </view>

      <!-- 退款信息 -->
      <view class="info-card card-dark">
        <view class="row">
          <text class="label">订单号</text>
          <text class="value monospace">{{ ticket.orderNo }}</text>
        </view>
        <view class="row">
          <text class="label">订单总额</text>
          <text class="value">¥{{ ticket.paidAmount }}</text>
        </view>
        <view class="row">
          <text class="label">退款金额</text>
          <text class="value highlight">¥{{ ticket.refundAmount }}</text>
        </view>
      </view>

      <!-- 退款方式 -->
      <view class="info-card card-dark">
        <view class="row">
          <text class="label">退款方式</text>
          <view class="refund-method">
            <text class="value">退回原支付账户</text>
            <view class="wechat-pill">
              <text class="wechat-icon">💚</text>
              <text class="wechat-text">微信支付</text>
            </view>
          </view>
        </view>
        <text class="tips">
          退款提交后，预计 1 个工作日内原路返回至您的微信支付账户，具体到账时间以银行及支付机构为准。
        </text>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>

    <!-- 底部提交栏 -->
    <view class="bottom-bar safe-area-bottom">
      <view class="amount-block">
        <text class="amount-label">退款总额</text>
        <text class="amount-value">¥{{ ticket.refundAmount }}</text>
      </view>
      <button class="btn-gold submit-btn" :loading="submitting" @click="submitRefund">
        立即提交
      </button>
    </view>
  </view>
</template>

<script>
import { mockMyTickets } from '@/utils/mockData.js'

export default {
  data() {
    return {
      ticketId: '',
      ticket: {},
      submitting: false
    }
  },

  onLoad(options) {
    this.ticketId = options.id
    this.loadTicket()
  },

  methods: {
    loadTicket() {
      const found = mockMyTickets.find((item) => item.id === this.ticketId)
      if (found) {
        this.ticket = found
      } else {
        uni.showToast({
          title: '票券不存在',
          icon: 'none'
        })
        setTimeout(() => {
          uni.navigateBack()
        }, 800)
      }
    },

    submitRefund() {
      if (this.submitting) return
      this.submitting = true

      // 模拟调用退款接口
      setTimeout(() => {
        this.submitting = false

        const isSuccess = Math.random() > 0.2
        if (isSuccess) {
          // 标记为退款中，返回票夹后展示“退款中”状态
          this.ticket.status = 'refunding'
          uni.showModal({
            title: '退票成功',
            content: '退款已发起，预计1个工作日内退回至微信支付账户。',
            showCancel: false,
            success: () => {
              // 返回票夹首页
              uni.switchTab({
                url: '/pages/my-tickets/my-tickets'
              })
            }
          })
        } else {
          uni.showModal({
            title: '退票失败',
            content: '退票失败，请联系客服协助处理。',
            showCancel: false,
            success: () => {
              uni.switchTab({
                url: '/pages/my-tickets/my-tickets'
              })
            }
          })
        }
      }, 1200)
    }
  }
}
</script>

<style lang="scss" scoped>
.ticket-refund-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.refund-scroll {
  padding: 24rpx 24rpx 0;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.order-card {
  padding: 20rpx 24rpx 18rpx;
  margin-bottom: 20rpx;
}

.order-header {
  display: flex;
  align-items: center;
}

.thumb-placeholder {
  width: 112rpx;
  height: 112rpx;
  border-radius: $radius-md;
  background: radial-gradient(circle at 0% 0%, rgba(216, 252, 15, 0.26), transparent 55%), $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.thumb-text {
  font-size: 36rpx;
  font-weight: 700;
  color: $cr7-gold-light;
}

.order-main {
  flex: 1;
}

.event-name {
  font-size: $font-md;
  color: $text-white;
  font-weight: 600;
}

.ticket-line {
  margin-top: 6rpx;
  font-size: $font-sm;
  color: $text-light;
}

.event-date {
  margin-top: 4rpx;
  font-size: $font-xs;
  color: $text-muted;
}

.order-tag {
  margin-left: 12rpx;
}

.tag-text {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: $font-xs;
  background: rgba(216, 252, 15, 0.18);
  color: $cr7-gold-light;
}

.rule-pill {
  margin-top: 14rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(216, 252, 15, 0.12);
  color: $cr7-gold-light;
  font-size: $font-xs;
}

.info-card {
  padding: 20rpx 24rpx 16rpx;
  margin-bottom: 20rpx;
}

.row {
  padding: 10rpx 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label {
  font-size: $font-sm;
  color: $text-light;
}

.value {
  font-size: $font-sm;
  color: $text-white;
}

.value.highlight {
  color: $cr7-gold-light;
  font-size: $font-md;
  font-weight: 700;
}

.value.monospace {
  font-family: 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: $font-xs;
}

.refund-method {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
}

.wechat-pill {
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(67, 207, 124, 0.18);
  display: flex;
  align-items: center;
}

.wechat-icon {
  margin-right: 4rpx;
}

.wechat-text {
  font-size: $font-xs;
  color: #43cf7c;
}

.tips {
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-muted;
  line-height: 1.7;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18rpx 24rpx;
  background: $cr7-dark;
  border-top: 1rpx solid $cr7-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.amount-block {
  display: flex;
  flex-direction: column;
}

.amount-label {
  font-size: $font-xs;
  color: $text-muted;
}

.amount-value {
  margin-top: 4rpx;
  font-size: $font-lg;
  color: $cr7-gold-light;
  font-weight: 700;
}

.submit-btn {
  flex: 1;
  height: 80rpx;
}

.safe-bottom {
  height: 80rpx;
}
</style>

