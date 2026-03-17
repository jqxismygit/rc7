<template>
  <view class="ticket-detail-page">
    <scroll-view class="detail-scroll" scroll-y :style="{ paddingBottom: ticket.status === 'unused' ? '180rpx' : '40rpx' }">
      <!-- 状态标签 + 票号 -->
      <view class="status-row">
        <view class="status-tag" :class="'tag-' + ticket.status">
          <view class="status-dot" :class="'dot-' + ticket.status" />
          <text class="status-label">{{ getStatusText(ticket.status) }}</text>
        </view>
        <view class="ticket-no-wrap">
          <text class="ticket-no">票号:{{ ticket.id }}</text>
        </view>
      </view>

      <!-- 活动主卡片 -->
      <view class="event-main-card">
        <view class="event-card-inner card-dark">
          <image
            :src="'/static/images/event-card.jpg'"
            mode="aspectFill"
            class="event-cover"
          />
          <view class="event-info-wrap">
            <text class="event-title">{{ ticket.eventName }}</text>
            <view class="event-meta-item">
              <text class="meta-icon">🕐</text>
              <text class="meta-text">{{ ticket.eventDate }}</text>
            </view>
            <view class="event-meta-item">
              <text class="meta-icon">📍</text>
              <text class="meta-text">{{ ticket.eventLocation }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 电子票二维码 -->
      <view class="qr-section">
        <view class="qr-card">
          <text class="qr-title">电子票二维码</text>
          <view class="qr-code-wrap">
            <view class="qr-code-placeholder" />
          </view>
          <text class="qr-id">ID: {{ formatTicketId(ticket.id) }}</text>
          <text class="qr-hint">使用时请向工作人员出示此码</text>
        </view>
      </view>

      <!-- 票务详情列表 -->
      <view class="detail-list card-dark">
        <view class="detail-row">
          <text class="detail-label">票种</text>
          <text class="detail-value">{{ ticket.ticketType }}</text>
        </view>
        <view class="detail-row">
          <text class="detail-label">数量</text>
          <text class="detail-value">{{ ticket.quantity }} 张</text>
        </view>
        <view class="detail-row">
          <text class="detail-label">购买时间</text>
          <text class="detail-value">{{ ticket.purchaseTime }}</text>
        </view>
        <view class="detail-row detail-row-last">
          <text class="detail-label">订单总额</text>
          <text class="detail-value price">¥ {{ formatPrice(ticket.price) }}</text>
        </view>
      </view>

      <!-- 使用说明 -->
      <view class="instructions-section">
        <view class="instructions-header">
          <text class="info-icon">ⓘ</text>
          <text class="instructions-title">使用说明</text>
        </view>
        <view class="instructions-card card-dark">
          <text v-for="(item, index) in noticeList" :key="index" class="instruction-item">{{ item }}</text>
        </view>
      </view>

      <view class="scroll-bottom-space" />
    </scroll-view>

    <!-- 底部操作栏 -->
    <view v-if="ticket.status === 'unused'" class="bottom-bar safe-area-bottom">
      <view class="bottom-bar-inner">
        <button class="action-btn outline-btn" @click="handleRefund">
          申请退票
        </button>
        <button class="action-btn outline-btn" @click="handleInvoice">
          开具发票
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { mockMyTickets } from '@/utils/mockData.js'

const NOTICE_LIST = [
  '1. 入场时请向工作人员出示此二维码，核销后即可入场；',
  '2. 每张票券仅可核销一次，截图或复制无效；',
  '3. 建议提前30分钟到达现场，以免错过参观时段；',
  '4. 入场需携带本人身份证件，部分场次可能进行安检。'
]

export default {
  data() {
    return {
      ticketId: '',
      ticket: {},
      noticeList: NOTICE_LIST
    }
  },

  onLoad(options) {
    this.ticketId = options.id
    this.loadTicketDetail()
  },

  methods: {
    loadTicketDetail() {
      const ticket = mockMyTickets.find(item => item.id === this.ticketId)
      if (ticket) {
        this.ticket = ticket
      }
    },

    getStatusText(status) {
      const statusMap = {
        unused: '待使用',
        used: '已入场',
        refunding: '退款中',
        refunded: '已退款'
      }
      return statusMap[status] || status
    },

    formatTicketId(id) {
      if (!id) return ''
      const raw = id.replace(/\D/g, '')
      return raw.replace(/(.{4})/g, '$1 ').trim()
    },

    formatPrice(price) {
      if (!price && price !== 0) return '0.00'
      return Number(price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    },

    handleRefund() {
      uni.showModal({
        title: '确认退票',
        content: '退票后将原路退款至您的支付账户，确定要退票吗？',
        success: (res) => {
          if (res.confirm) {
            uni.showLoading({ title: '处理中...' })
            setTimeout(() => {
              uni.hideLoading()
              uni.showToast({ title: '退票成功', icon: 'success' })
              this.ticket.status = 'refunded'
            }, 1500)
          }
        }
      })
    },

    handleInvoice() {
      uni.showToast({ title: '发票功能开发中', icon: 'none' })
    }
  }
}
</script>

<style lang="scss" scoped>
.ticket-detail-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.detail-scroll {
  height: 100vh;
}

/* ===== 状态标签 + 票号 ===== */
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 30rpx 0;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 34rpx;
  height: 62rpx;
  border-radius: 999rpx;
}

.tag-unused {
  background: rgba(216, 251, 14, 0.2);
  border: 2rpx solid rgba(216, 251, 14, 0.3);
}

.tag-used {
  background: rgba(46, 204, 113, 0.2);
  border: 2rpx solid rgba(46, 204, 113, 0.3);
}

.tag-refunding {
  background: rgba(243, 156, 18, 0.2);
  border: 2rpx solid rgba(243, 156, 18, 0.3);
}

.tag-refunded {
  background: rgba(201, 56, 56, 0.2);
  border: 2rpx solid rgba(201, 56, 56, 0.3);
}

.status-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.dot-unused { background: $cr7-gold; }
.dot-used { background: $cr7-success; }
.dot-refunding { background: $cr7-warning; }
.dot-refunded { background: $cr7-red; }

.status-label {
  font-size: 28rpx;
  font-weight: 500;
}

.tag-unused .status-label { color: $cr7-gold; }
.tag-used .status-label { color: $cr7-success; }
.tag-refunding .status-label { color: $cr7-warning; }
.tag-refunded .status-label { color: $cr7-red; }

.ticket-no-wrap {
  display: flex;
  align-items: center;
}

.ticket-no {
  font-size: 24rpx;
  color: $text-disabled;
}

/* ===== 活动主卡片 ===== */
.event-main-card {
  padding: 30rpx;
}

.event-card-inner {
  overflow: hidden;
}

.event-cover {
  width: 100%;
  height: 380rpx;
}

.event-info-wrap {
  padding: 38rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.event-title {
  font-size: 34rpx;
  color: $text-white;
  font-weight: 500;
  letter-spacing: -1rpx;
  line-height: 1.6;
}

.event-meta-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.meta-icon {
  font-size: 22rpx;
  width: 28rpx;
  text-align: center;
}

.meta-text {
  font-size: 28rpx;
  color: $text-light;
  line-height: 1.4;
}

/* ===== 电子票二维码 ===== */
.qr-section {
  padding: 0 30rpx 46rpx;
}

.qr-card {
  background: $cr7-card;
  border-radius: $radius-xl;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 62rpx;
}

.qr-title {
  font-size: 36rpx;
  color: $text-white;
  font-weight: 500;
  margin-bottom: 30rpx;
}

.qr-code-wrap {
  background: #ffffff;
  border-radius: 62rpx;
  padding: 30rpx;
  box-shadow: inset 0 4rpx 8rpx rgba(0, 0, 0, 0.05);
}

.qr-code-placeholder {
  width: 370rpx;
  height: 370rpx;
  background: #e2e8f0;
}

.qr-id {
  font-size: 24rpx;
  color: $text-light;
  margin-top: 16rpx;
}

.qr-hint {
  font-size: 20rpx;
  color: $text-light;
  margin-top: 8rpx;
}

/* ===== 票务详情列表 ===== */
.detail-list {
  margin: 0 30rpx;
  padding: 30rpx;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
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

.detail-value.price {
  color: $cr7-gold;
  font-weight: 700;
}

/* ===== 使用说明 ===== */
.instructions-section {
  padding: 46rpx 30rpx;
}

.instructions-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.info-icon {
  font-size: 28rpx;
  color: $text-white;
}

.instructions-title {
  font-size: $font-base;
  color: $text-white;
  font-weight: 500;
}

.instructions-card {
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.instruction-item {
  font-size: 24rpx;
  color: $text-light;
  line-height: 1.8;
}

.scroll-bottom-space {
  height: 40rpx;
}

/* ===== 底部操作栏 ===== */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: $cr7-dark;
  border-top: 1rpx solid $cr7-border;
  backdrop-filter: blur(12px);
  padding: 16rpx 30rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.bottom-bar-inner {
  display: flex;
  gap: 30rpx;
  align-items: center;
}

.action-btn {
  flex: 1;
  height: 98rpx;
  border-radius: 999rpx;
  font-size: $font-base;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: normal;
}

.outline-btn {
  background: transparent;
  border: 2rpx solid $cr7-gold;
  color: $text-white;
}

.outline-btn::after {
  border: none;
}
</style>
