<template>
  <view class="container">
    <scroll-view class="content" scroll-y>
      <!-- 活动信息 -->
      <view class="event-info">
        <text class="event-name">{{ eventName }}</text>
        <text class="event-date">🕐 {{ eventDate }}</text>
      </view>

      <!-- 票种选择 -->
      <view class="ticket-types">
        <text class="section-title">选择票种</text>
        <view 
          v-for="ticket in ticketTypes" 
          :key="ticket.id"
          class="ticket-type-item"
          :class="{ active: selectedTicket && selectedTicket.id === ticket.id }"
          @click="selectTicket(ticket)"
        >
          <view class="ticket-info">
            <view class="ticket-header">
              <text class="ticket-name">{{ ticket.name }}</text>
              <text v-if="ticket.tag" class="ticket-tag">{{ ticket.tag }}</text>
            </view>
            <text class="ticket-desc">{{ ticket.description }}</text>
            <text class="stock-info">剩余 {{ ticket.stock }} 张</text>
          </view>
          <view class="ticket-price">
            <text class="price">¥{{ ticket.price }}</text>
            <text v-if="ticket.originalPrice > ticket.price" class="original-price">
              ¥{{ ticket.originalPrice }}
            </text>
          </view>
        </view>
      </view>

      <!-- 日期选择 -->
      <view class="date-section">
        <text class="section-title">选择日期</text>
        <picker mode="date" :value="selectedDate" @change="onDateChange">
          <view class="date-picker">
            <text>{{ selectedDate || '请选择日期' }}</text>
            <text class="arrow">›</text>
          </view>
        </picker>
      </view>

      <!-- 购票须知 -->
      <view class="notice-section">
        <text class="section-title">购票须知</text>
        <text class="notice-text">
          1. 每个账号限购5张
          2. 早鸟票不支持退款
          3. 开展前48小时可全额退款
          4. 请妥善保管票券二维码
          5. 入场时需出示有效证件
        </text>
      </view>
    </scroll-view>

    <!-- 底部购买栏 -->
    <view class="bottom-bar">
      <view class="total-price">
        <text class="label">合计</text>
        <text class="price">¥{{ totalPrice }}</text>
      </view>
      <button 
        class="buy-btn" 
        :disabled="!selectedTicket || !selectedDate"
        @click="handlePurchase"
      >
        确认购买
      </button>
    </view>
  </view>
</template>

<script>
import { mockTicketTypes, mockHomeCards } from '@/utils/mockData.js'

export default {
  data() {
    return {
      eventId: '',
      eventName: '',
      eventDate: '',
      ticketTypes: [],
      selectedTicket: null,
      selectedDate: ''
    }
  },
  
  computed: {
    totalPrice() {
      return this.selectedTicket ? this.selectedTicket.price : 0
    }
  },
  
  onLoad(options) {
    this.eventId = options.eventId
    this.loadEventInfo()
    this.loadTicketTypes()
  },
  
  methods: {
    loadEventInfo() {
      const event = mockHomeCards.find(item => item.id == this.eventId)
      if (event) {
        this.eventName = event.title
        this.eventDate = event.date
      }
    },
    
    loadTicketTypes() {
      this.ticketTypes = mockTicketTypes
    },
    
    selectTicket(ticket) {
      if (ticket.stock > 0) {
        this.selectedTicket = ticket
      } else {
        uni.showToast({
          title: '该票种已售罄',
          icon: 'none'
        })
      }
    },
    
    onDateChange(e) {
      this.selectedDate = e.detail.value
    },
    
    handlePurchase() {
      if (!this.selectedTicket) {
        uni.showToast({
          title: '请选择票种',
          icon: 'none'
        })
        return
      }
      
      if (!this.selectedDate) {
        uni.showToast({
          title: '请选择日期',
          icon: 'none'
        })
        return
      }
      
      // 模拟微信支付
      uni.showLoading({ title: '正在支付...' })
      
      setTimeout(() => {
        uni.hideLoading()
        uni.showToast({
          title: '购买成功',
          icon: 'success'
        })
        
        setTimeout(() => {
          uni.switchTab({
            url: '/pages/my-tickets/my-tickets'
          })
        }, 1500)
      }, 2000)
    }
  }
}
</script>

<style scoped>
.container {
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
}

.content {
  height: calc(100vh - 120rpx);
  padding: 30rpx;
}

.event-info {
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
  margin-bottom: 15rpx;
}

.event-date {
  font-size: 26rpx;
  color: #666;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.ticket-types {
  background: #fff;
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}

.ticket-type-item {
  display: flex;
  justify-content: space-between;
  padding: 30rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.ticket-type-item:last-child {
  margin-bottom: 0;
}

.ticket-type-item.active {
  border-color: #667eea;
  background: #f5f7ff;
}

.ticket-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.ticket-header {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.ticket-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.ticket-tag {
  padding: 4rpx 12rpx;
  background: #ff4444;
  color: #fff;
  font-size: 20rpx;
  border-radius: 6rpx;
}

.ticket-desc {
  font-size: 24rpx;
  color: #999;
}

.stock-info {
  font-size: 22rpx;
  color: #ff9800;
}

.ticket-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
}

.price {
  font-size: 36rpx;
  color: #ff4444;
  font-weight: bold;
}

.original-price {
  font-size: 24rpx;
  color: #999;
  text-decoration: line-through;
}

.date-section {
  background: #fff;
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}

.date-picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  font-size: 28rpx;
  color: #333;
}

.arrow {
  font-size: 40rpx;
  color: #ccc;
}

.notice-section {
  background: #fff;
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
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
  height: 120rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}

.total-price {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 24rpx;
  color: #999;
}

.buy-btn {
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

.buy-btn::after {
  border: none;
}

.buy-btn[disabled] {
  background: #ccc;
}
</style>
