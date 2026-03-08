<template>
  <view class="tickets-page">
    <!-- 顶部工具栏：票码兑换 / 三方票同步 -->
    <view class="ticket-toolbar card-dark">
      <view class="tool-item" @click="goToExchange">
        <text class="tool-icon">🔐</text>
        <text class="tool-text">票码兑换</text>
      </view>
      <view class="divider-vertical"></view>
      <view class="tool-item" @click="syncThirdTickets">
        <text class="tool-icon">🔄</text>
        <text class="tool-text">三方票同步</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="tickets.length === 0" class="empty">
      <view class="empty-badge">
        <text class="empty-cr7">CR7</text>
      </view>
      <text class="empty-text">暂无票券，先去解锁一次传奇体验吧</text>
      <button class="btn-gold empty-btn" @click="goToBuy">立即购票</button>
    </view>

    <!-- 票券列表 -->
    <scroll-view v-else class="ticket-scroll" scroll-y>
      <view
        v-for="ticket in tickets"
        :key="ticket.id"
        class="ticket-card card-dark"
      >
        <view class="ticket-header">
          <view class="museum-line">
            <text class="museum-name">{{ ticket.eventName }}</text>
            <text class="ticket-tag" :class="ticket.isThird ? 'tag-third' : 'tag-official'">
              {{ ticket.isThird ? '三方票' : '官方票' }}
            </text>
          </view>
          <text class="refund-rule">
            {{ ticket.refundRule || '开展前48小时可退' }}
          </text>
        </view>

        <view class="ticket-body" @click="goToDetail(ticket)">
          <view class="ticket-info">
            <text class="ticket-type">
              {{ ticket.ticketType }} × {{ ticket.quantity }}
            </text>
            <text class="ticket-time">
              参展时间：{{ ticket.eventDate }}
            </text>
          </view>
          <view class="ticket-status-block">
            <text class="status-label" :class="'status-' + ticket.status">
              {{ getStatusText(ticket.status) }}
            </text>
          </view>
        </view>

        <view class="ticket-footer">
          <text class="ticket-price">¥{{ ticket.price }}</text>
          <view class="footer-actions">
            <button
              class="outline-btn"
              :class="{ disabled: ticket.status === 'refunding' }"
              :disabled="ticket.status === 'refunding'"
              @click.stop="goToDetail(ticket)"
            >
              查看券码
            </button>
            <button
              v-if="showRefundButton(ticket)"
              class="outline-btn danger"
              :class="{ disabled: !canApplyRefund(ticket) || ticket.status === 'refunding' }"
              :disabled="!canApplyRefund(ticket) || ticket.status === 'refunding'"
              @click.stop="onRefundClick(ticket)"
            >
              {{ getRefundButtonText(ticket) }}
            </button>
            <button
              v-if="ticket.status === 'refunded'"
              class="outline-btn subtle"
              @click.stop="handleDelete(ticket)"
            >
              删除票券
            </button>
          </view>
        </view>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
import { mockMyTickets } from '@/utils/mockData.js'
import createTabBarMixin from '@/mixins/tabBar.js'

export default {
  mixins: [createTabBarMixin(1)],
  data() {
    return {
      tickets: []
    }
  },

  onShow() {
    this.loadTickets()
  },

  methods: {
    loadTickets() {
      this.tickets = mockMyTickets
    },

    getStatusText(status) {
      const statusMap = {
        unused: '待核销',
        used: '已入场',
        refunding: '退款中',
        refunded: '已退款'
      }
      return statusMap[status] || status
    },

    // 是否显示“申请退票”按钮
    showRefundButton(ticket) {
      return ticket.canRefund && (ticket.status === 'unused' || ticket.status === 'refunding')
    },

    // 是否在退票时间窗口内（开展前48小时外）
    canApplyRefund(ticket) {
      if (!ticket.canRefund) return false
      if (ticket.status !== 'unused') return false
      if (!ticket.eventDate) return false
      const eventTime = new Date(ticket.eventDate.replace(/-/g, '/')).getTime()
      if (!eventTime) return false
      const now = Date.now()
      const hoursDiff = (eventTime - now) / (1000 * 60 * 60)
      return hoursDiff > 48
    },

    getRefundButtonText(ticket) {
      if (ticket.status === 'refunding') return '退款中'
      return '申请退票'
    },

    goToDetail(ticket) {
      uni.navigateTo({
        url: `/pages/ticket-detail/ticket-detail?id=${ticket.id}`
      })
    },

    onRefundClick(ticket) {
      if (!this.canApplyRefund(ticket)) return
      uni.navigateTo({
        url: `/pages/ticket-refund/ticket-refund?id=${ticket.id}`
      })
    },

    handleDelete(ticket) {
      uni.showModal({
        title: '删除票券',
        content: '删除后将无法在票夹中看到该票券记录，确认删除？',
        success: (res) => {
          if (res.confirm) {
            this.tickets = this.tickets.filter(t => t.id !== ticket.id)
          }
        }
      })
    },

    goToBuy() {
      uni.switchTab({
        url: '/pages/index/index'
      })
    },

    goToExchange() {
      uni.navigateTo({
        url: '/pages/vote/vote'
      })
    },

    syncThirdTickets() {
      uni.showModal({
        title: '三方票同步说明',
        content: '即将支持从第三方平台（如票务网站、小程序）同步购票记录，请留意后续版本更新。',
        showCancel: false
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.tickets-page {
  min-height: 100vh;
  background: $cr7-black;
  padding: 24rpx 24rpx 0;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.ticket-toolbar {
  margin-top: 8rpx;
  padding: 24rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tool-item {
  flex: 1;
  display: flex;
  align-items: center;
}

.tool-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
}

.tool-text {
  font-size: $font-md;
  color: $text-white;
}

.divider-vertical {
  width: 1rpx;
  height: 40rpx;
  background: $cr7-border;
  margin: 0 24rpx;
}

.empty {
  padding-top: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-badge {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: $gradient-gold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-gold;
  margin-bottom: 32rpx;
}

.empty-cr7 {
  font-size: 52rpx;
  font-weight: 800;
  color: $cr7-black;
}

.empty-text {
  font-size: $font-sm;
  color: $text-light;
  margin-bottom: 32rpx;
}

.empty-btn {
  width: 360rpx;
  height: 88rpx;
  margin-top: 8rpx;
}

.ticket-scroll {
  height: calc(100vh - 180rpx);
  margin-top: 24rpx;
}

.ticket-card {
  padding: 20rpx 24rpx 20rpx;
  margin-bottom: 24rpx;
}

.ticket-header {
  border-bottom: 1rpx solid $cr7-border;
  padding-bottom: 12rpx;
}

.museum-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.museum-name {
  font-size: $font-sm;
  color: $text-light;
}

.ticket-tag {
  font-size: $font-xs;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
}

.tag-official {
  background: rgba(216, 252, 15, 0.18);
  color: $cr7-gold-light;
}

.tag-third {
  background: rgba(127, 127, 127, 0.2);
  color: $text-light;
}

.refund-rule {
  margin-top: 6rpx;
  font-size: $font-xs;
  color: $text-muted;
}

.ticket-body {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0 8rpx;
}

.ticket-info {
  flex: 1;
}

.ticket-type {
  font-size: $font-md;
  color: $text-white;
}

.ticket-time {
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-light;
}

.ticket-status-block {
  margin-left: 24rpx;
  align-self: center;
}

.status-label {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: $font-xs;
}

.status-unused {
  background: rgba(216, 252, 15, 0.18);
  color: $cr7-gold-light;
}

.status-used {
  background: rgba(46, 204, 113, 0.18);
  color: $cr7-success;
}

.status-refunded {
  background: rgba(217, 0, 27, 0.18);
  color: $cr7-red;
}

.ticket-footer {
  padding-top: 12rpx;
  border-top: 1rpx solid $cr7-border;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ticket-price {
  font-size: $font-lg;
  color: $cr7-gold-light;
}

.footer-actions {
  display: flex;
  gap: 16rpx;
}

.outline-btn {
  padding: 10rpx 26rpx;
  border-radius: 999rpx;
  border: 1rpx solid $cr7-gold;
  font-size: $font-sm;
  color: $cr7-gold-light;
  background: transparent;
  line-height: normal;
}

.outline-btn::after {
  border: none;
}

.outline-btn.danger {
  border-color: $cr7-red;
  color: $cr7-red;
}

.outline-btn.subtle {
  border-color: $cr7-border;
  color: $text-light;
}

.outline-btn.disabled {
  border-color: $cr7-border;
  color: $text-muted;
  opacity: 0.6;
}

.safe-bottom {
  height: 80rpx;
}
</style>
