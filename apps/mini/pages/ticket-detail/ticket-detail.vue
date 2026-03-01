<template>
  <view class="ticket-detail-page">
    <scroll-view class="detail-scroll" scroll-y>
      <!-- 状态条 -->
      <view class="status-bar" :class="'status-' + ticket.status">
        <text class="status-text">{{ getStatusText(ticket.status) }}</text>
      </view>

      <!-- 二维码卡片 -->
      <view class="qr-card card-dark">
        <image :src="ticket.qrCode" mode="aspectFit" class="qr-code" />
        <text class="ticket-id">票号：{{ ticket.id }}</text>
      </view>

      <!-- 票券信息 -->
      <view class="info-card card-dark">
        <text class="event-name">{{ ticket.eventName }}</text>
        <view class="info-item">
          <text class="label">活动时间</text>
          <text class="value">{{ ticket.eventDate }}</text>
        </view>
        <view class="info-item">
          <text class="label">票种</text>
          <text class="value">{{ ticket.ticketType }}</text>
        </view>
        <view class="info-item">
          <text class="label">数量</text>
          <text class="value">{{ ticket.quantity }} 张</text>
        </view>
        <view class="info-item">
          <text class="label">购买时间</text>
          <text class="value">{{ ticket.purchaseTime }}</text>
        </view>
        <view class="info-item">
          <text class="label">订单金额</text>
          <text class="value price">¥{{ ticket.price }}</text>
        </view>
      </view>

      <!-- 使用说明 -->
      <view class="notice-card card-dark">
        <text class="section-title">使用说明</text>
        <text class="notice-text">{{ noticeText }}</text>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view v-if="ticket.status === 'unused'" class="bottom-bar safe-area-bottom">
      <button
        v-if="ticket.canRefund"
        class="outline-btn danger"
        @click="handleRefund"
      >
        申请退票
      </button>
      <button class="btn-gold invoice-btn" @click="handleInvoice">
        开具发票
      </button>
    </view>
  </view>
</template>

<script>
import { mockMyTickets } from '@/utils/mockData.js'

const NOTICE_TEXT = `1. 入场时请向工作人员出示此二维码，核销后即可入场；
2. 每张票券仅可核销一次，截图或复制无效；
3. 建议提前 30 分钟到达现场，以免错过参观时段；
4. 入场需携带本人身份证件，部分场次可能进行安检。`

export default {
  data() {
    return {
      ticketId: '',
      ticket: {},
      noticeText: NOTICE_TEXT
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
        unused: '待核销',
        used: '已入场',
        refunded: '已退款'
      }
      return statusMap[status] || status
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
              uni.showToast({
                title: '退票成功',
                icon: 'success'
              })
              this.ticket.status = 'refunded'
            }, 1500)
          }
        }
      })
    },

    handleInvoice() {
      if (this.ticket.status !== 'used') {
        uni.showToast({
          title: '票券使用后才能开具发票',
          icon: 'none'
        })
        return
      }

      uni.showToast({
        title: '发票功能开发中',
        icon: 'none'
      })
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
  padding: 24rpx 24rpx 0;
}

.status-bar {
  padding: 18rpx 24rpx;
  border-radius: $radius-lg;
  margin-bottom: 20rpx;
  text-align: center;
}

.status-unused {
  background: rgba(201, 168, 76, 0.22);
}

.status-used {
  background: rgba(46, 204, 113, 0.22);
}

.status-refunded {
  background: rgba(217, 0, 27, 0.22);
}

.status-text {
  font-size: $font-md;
  color: $text-white;
  font-weight: 600;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.qr-card {
  padding: 40rpx 24rpx 26rpx;
  align-items: center;
  text-align: center;
  margin-bottom: 20rpx;
}

.qr-code {
  width: 360rpx;
  height: 360rpx;
  margin: 0 auto 20rpx;
}

.ticket-id {
  font-size: $font-xs;
  color: $text-muted;
}

.info-card {
  padding: 24rpx 24rpx 18rpx;
  margin-bottom: 20rpx;
}

.event-name {
  font-size: $font-lg;
  color: $text-white;
  font-weight: 600;
  padding-bottom: 14rpx;
  margin-bottom: 10rpx;
  border-bottom: 1rpx solid $cr7-border;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0;
}

.label {
  font-size: $font-sm;
  color: $text-light;
}

.value {
  font-size: $font-sm;
  color: $text-white;
}

.value.price {
  font-size: $font-md;
  color: $cr7-gold-light;
  font-weight: 700;
}

.notice-card {
  padding: 24rpx 24rpx 20rpx;
}

.section-title {
  font-size: $font-md;
  color: $text-white;
  font-weight: 600;
  margin-bottom: 8rpx;
}

.notice-text {
  font-size: $font-sm;
  color: $text-light;
  line-height: 1.8;
  white-space: pre-line;
}

.safe-bottom {
  height: 80rpx;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 24rpx;
  background: $cr7-dark;
  border-top: 1rpx solid $cr7-border;
  display: flex;
  gap: 16rpx;
}

.outline-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 999rpx;
  border: 1rpx solid $cr7-gold;
  color: $cr7-gold-light;
  font-size: $font-sm;
  line-height: normal;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.outline-btn::after {
  border: none;
}

.outline-btn.danger {
  border-color: $cr7-red;
  color: $cr7-red;
}

.invoice-btn {
  flex: 1;
  height: 80rpx;
}
</style>
