<template>
  <view class="order-page">
    <!-- 悬浮导航栏 -->
    <view class="nav-bar safe-area-top">
      <view class="nav-back" @click="goBack">
        <text class="nav-back-icon">‹</text>
      </view>
      <text class="nav-title">购票</text>
      <view class="nav-placeholder"></view>
    </view>

    <scroll-view class="order-scroll" scroll-y>
      <!-- 标题 -->
      <view class="section section-title-block">
        <text class="order-title">
          {{ order.eventName || 'C罗博物馆 CR7LIFE上海博物馆门票' }}
        </text>
      </view>

      <!-- 展馆卡片 -->
      <view class="section">
        <view class="ticket-card card-dark">
          <view class="ticket-card-main">
            <text class="museum-address">
              {{ order.museumLocation || '上海市黄浦区王府井大街123号' }}
            </text>
            <text class="valid-text">
              有效期：{{ order.validDate || order.visitDate || '2026.02.28' }}
            </text>
            <view class="ticket-meta-row">
              <text class="ticket-meta">数量：{{ order.quantity || 1 }}</text>
            </view>
          </view>
          <image
            class="ticket-cover"
            src="/static/images/event-card.jpg"
            mode="aspectFill"
          />
        </view>
      </view>

      <!-- 预约详情 -->
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
          <text class="detail-value">
            {{ order.phone || '+86 138 0000 0000' }}
          </text>
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

      <!-- 分割线 -->
      <view class="divider-line"></view>

      <!-- 支付方式 -->
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

      <!-- 总额 -->
      <view class="footer-total">
        <text class="total-label">总额</text>
        <text class="total-value">¥ {{ order.amount || '125.00' }}</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <!-- 底部总额 + 立即支付 -->
    <view class="footer-wrap safe-area-bottom">
      <view class="bottom-bar">
        <button class="btn-gold pay-btn" @click="handlePay">
          立即支付
        </button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      order: {
        eventName: '',
        museumLocation: '',
        visitDate: '',
        ticketName: '',
        quantity: 1,
        amount: '',
        phone: ''
      }
    }
  },

  onLoad(options) {
    this.order = {
      eventName: decodeURIComponent(options.eventName || '') || 'C罗博物馆 CR7LIFE上海博物馆门票',
      museumLocation: decodeURIComponent(options.museumLocation || '') || '上海市黄浦区王府井大街123号',
      visitDate: options.visitDate || '',
      ticketName: decodeURIComponent(options.ticketName || ''),
      quantity: Number(options.quantity || 1),
      amount: options.amount || '125.00',
      phone: options.phone || '+86 138 0000 0000'
    }
  },

  methods: {
    goBack() {
      uni.navigateBack()
    },

    handlePay() {
      uni.showLoading({ title: '发起支付...' })
      setTimeout(() => {
        uni.hideLoading()
        uni.showToast({ title: '支付成功', icon: 'success' })
        setTimeout(() => {
          uni.switchTab({ url: '/pages/my-tickets/my-tickets' })
        }, 1500)
      }, 1500)
    }
  }
}
</script>

<style lang="scss" scoped>
.order-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
  position: relative;
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
  line-height: 40rpx;
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
  height: 189rpx;
}

.footer-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  border-top: 1rpx solid $cr7-border;
  background: $cr7-dark;
  padding: 24rpx 35rpx 12rpx;
  height: 189rpx;
}

.footer-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.bottom-bar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pay-btn {
  width: 679rpx;
  height: 98rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: $cr7-black;
}
</style>
