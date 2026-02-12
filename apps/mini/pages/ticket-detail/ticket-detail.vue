<template>
  <view class="container">
    <scroll-view class="content" scroll-y>
      <!-- 票券状态 -->
      <view class="status-card" :class="'status-' + ticket.status">
        <text class="status-text">{{ getStatusText(ticket.status) }}</text>
      </view>

      <!-- 二维码 -->
      <view class="qr-section">
        <image :src="ticket.qrCode" mode="aspectFit" class="qr-code"></image>
        <text class="ticket-id">票号：{{ ticket.id }}</text>
      </view>

      <!-- 票券信息 -->
      <view class="info-section">
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
      <view class="notice-section">
        <text class="section-title">使用说明</text>
        <text class="notice-text">
          1. 入场时请出示此二维码
          2. 每个二维码仅可使用一次
          3. 请提前30分钟到达现场
          4. 请携带有效身份证件
        </text>
      </view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view v-if="ticket.status === 'unused'" class="bottom-bar">
      <button 
        v-if="ticket.canRefund" 
        class="action-btn refund-btn"
        @click="handleRefund"
      >
        申请退票
      </button>
      <button class="action-btn invoice-btn" @click="handleInvoice">
        开具发票
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
      ticket: {}
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
        unused: '未使用',
        used: '已使用',
        refunded: '已退票'
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

<style scoped>
.container {
  width: 100%;
  min-height: 100vh;
  background: #f5f5f5;
}

.content {
  padding: 30rpx;
  padding-bottom: 150rpx;
}

.status-card {
  text-align: center;
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}

.status-unused {
  background: linear-gradient(135deg, #4caf50 0%, #8bc34a 100%);
}

.status-used {
  background: #9e9e9e;
}

.status-refunded {
  background: #f44336;
}

.status-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.qr-section {
  background: #fff;
  padding: 60rpx;
  border-radius: 16rpx;
  text-align: center;
  margin-bottom: 30rpx;
}

.qr-code {
  width: 400rpx;
  height: 400rpx;
  margin-bottom: 30rpx;
}

.ticket-id {
  font-size: 24rpx;
  color: #999;
}

.info-section {
  background: #fff;
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}

.event-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 30rpx;
  padding-bottom: 30rpx;
  border-bottom: 1px solid #f0f0f0;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1px solid #f8f8f8;
}

.info-item:last-child {
  border-bottom: none;
}

.label {
  font-size: 28rpx;
  color: #666;
}

.value {
  font-size: 28rpx;
  color: #333;
}

.value.price {
  font-size: 32rpx;
  color: #ff4444;
  font-weight: bold;
}

.notice-section {
  background: #fff;
  padding: 30rpx;
  border-radius: 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.notice-text {
  font-size: 24rpx;
  color: #666;
  line-height: 1.8;
  white-space: pre-line;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 20rpx 30rpx;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  display: flex;
  gap: 20rpx;
}

.action-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
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
  border: 2rpx solid #ff4444;
}

.invoice-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
</style>
