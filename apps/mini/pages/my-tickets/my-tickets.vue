<template>
  <view class="container">
    <view v-if="tickets.length === 0" class="empty">
      <text class="empty-icon">🎫</text>
      <text class="empty-text">暂无票券</text>
      <button class="go-buy-btn" @click="goToBuy">去购票</button>
    </view>

    <scroll-view v-else class="ticket-list" scroll-y>
      <view 
        v-for="ticket in tickets" 
        :key="ticket.id"
        class="ticket-item"
        @click="goToDetail(ticket)"
      >
        <view class="ticket-header">
          <view class="ticket-status" :class="'status-' + ticket.status">
            {{ getStatusText(ticket.status) }}
          </view>
        </view>
        
        <view class="ticket-content">
          <view class="ticket-info">
            <text class="event-name">{{ ticket.eventName }}</text>
            <text class="event-date">🕐 {{ ticket.eventDate }}</text>
            <text class="ticket-type">{{ ticket.ticketType }} × {{ ticket.quantity }}</text>
          </view>
          
          <view class="ticket-qr">
            <image :src="ticket.qrCode" mode="aspectFit"></image>
          </view>
        </view>
        
        <view class="ticket-footer">
          <text class="price">¥{{ ticket.price }}</text>
          <view class="actions">
            <button 
              v-if="ticket.status === 'unused' && ticket.canRefund" 
              class="action-btn refund-btn"
              @click.stop="handleRefund(ticket)"
            >
              退票
            </button>
            <button class="action-btn detail-btn" @click.stop="goToDetail(ticket)">
              查看详情
            </button>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { mockMyTickets } from '@/utils/mockData.js'

export default {
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
        unused: '未使用',
        used: '已使用',
        refunded: '已退票'
      }
      return statusMap[status] || status
    },
    
    goToDetail(ticket) {
      uni.navigateTo({
        url: `/pages/ticket-detail/ticket-detail?id=${ticket.id}`
      })
    },
    
    handleRefund(ticket) {
      uni.showModal({
        title: '确认退票',
        content: '退票后将原路退款，确定要退票吗？',
        success: (res) => {
          if (res.confirm) {
            uni.showLoading({ title: '处理中...' })
            setTimeout(() => {
              uni.hideLoading()
              uni.showToast({
                title: '退票成功',
                icon: 'success'
              })
              ticket.status = 'refunded'
            }, 1500)
          }
        }
      })
    },
    
    goToBuy() {
      uni.switchTab({
        url: '/pages/index/index'
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 30rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 60rpx;
}

.go-buy-btn {
  width: 300rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: normal;
}

.go-buy-btn::after {
  border: none;
}

.ticket-list {
  height: calc(100vh - 60rpx);
}

.ticket-item {
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
  overflow: hidden;
}

.ticket-header {
  padding: 20rpx 30rpx;
  background: #f8f8f8;
  display: flex;
  justify-content: flex-end;
}

.ticket-status {
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.status-unused {
  background: #e8f5e9;
  color: #4caf50;
}

.status-used {
  background: #e0e0e0;
  color: #757575;
}

.status-refunded {
  background: #ffebee;
  color: #f44336;
}

.ticket-content {
  display: flex;
  padding: 30rpx;
}

.ticket-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}

.event-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.event-date,
.ticket-type {
  font-size: 26rpx;
  color: #666;
}

.ticket-qr {
  width: 150rpx;
  height: 150rpx;
}

.ticket-qr image {
  width: 100%;
  height: 100%;
}

.ticket-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-top: 1px solid #f0f0f0;
}

.price {
  font-size: 36rpx;
  color: #ff4444;
  font-weight: bold;
}

.actions {
  display: flex;
  gap: 20rpx;
}

.action-btn {
  padding: 12rpx 30rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: normal;
}

.action-btn::after {
  border: none;
}

.refund-btn {
  background: #fff;
  color: #ff4444;
  border: 1px solid #ff4444;
}

.detail-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
</style>
