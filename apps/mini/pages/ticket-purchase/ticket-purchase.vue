<template>
  <view class="purchase-page">
    <scroll-view class="purchase-scroll" scroll-y>
      <!-- 展馆信息 -->
      <view class="museum-card card-dark">
        <text class="museum-name">{{ eventName || 'C罗博物馆 · 中国馆' }}</text>
        <text class="museum-sub">亚洲首个 CR7® LIFE 沉浸式博物馆</text>
        <view class="museum-meta">
          <text class="meta-item">🕐 {{ eventDate || '10:00 - 22:00（最晚入场 21:00）' }}</text>
          <text class="meta-item">📍 {{ museumLocation }}</text>
          <text class="meta-item">☎ 400-CR7-LIFE</text>
        </view>
      </view>

      <!-- 票种选择 -->
      <view class="section card-dark">
        <text class="section-title">选择票种</text>
        <view
          v-for="ticket in ticketTypes"
          :key="ticket.id"
          class="ticket-type"
          :class="{ active: selectedTicket && selectedTicket.id === ticket.id }"
          @click="selectTicket(ticket)"
        >
          <view class="ticket-main">
            <view class="ticket-header">
              <text class="ticket-name">{{ ticket.name }}</text>
              <text v-if="ticket.tag" class="ticket-tag">{{ ticket.tag }}</text>
            </view>
            <text class="ticket-desc">{{ ticket.description }}</text>
            <text class="ticket-stock">
              剩余 {{ ticket.stock }} 张
            </text>
          </view>
          <view class="ticket-price">
            <text class="price">¥{{ ticket.price }}</text>
            <text
              v-if="ticket.originalPrice > ticket.price"
              class="original-price"
            >
              ¥{{ ticket.originalPrice }}
            </text>
          </view>
        </view>
      </view>

      <!-- 日期选择 -->
      <view class="section card-dark">
        <text class="section-title">选择参观日期</text>
        <picker mode="date" :value="selectedDate" @change="onDateChange">
          <view class="date-picker">
            <text class="date-text">
              {{ selectedDate || '请选择日期' }}
            </text>
            <text class="date-arrow">›</text>
          </view>
        </picker>
        <text class="section-hint">
          建议至少提前一天完成购票，节假日高峰时段请尽早预约。
        </text>
      </view>

      <!-- 购票须知 -->
      <view class="section card-dark">
        <text class="section-title">购票须知</text>
        <text class="notice-text">
          1. 每个账号单笔限购 6 张，部分特殊票种不支持退款；
          2. 除「早鸟票」「特惠票」外，展览开始前 48 小时可全额退款；
          3. 入场需出示本人有效身份证件与电子票二维码，请妥善保管；
          4. 若遇不可抗力或馆方原因导致展览调整，将通过「消息中心」通知您。
        </text>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>

    <!-- 底部购买栏 -->
    <view class="bottom-bar safe-area-bottom">
      <view class="price-box">
        <text class="price-label">合计</text>
        <text class="total-price">¥{{ totalPrice }}</text>
      </view>
      <button
        class="btn-gold buy-btn"
        :disabled="!selectedTicket || !selectedDate"
        @click="handlePurchase"
      >
        立即购买
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
      museumLocation: '北京市朝阳区 国贸商圈',
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
        this.museumLocation = event.location || this.museumLocation
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
      if (!this.selectedTicket || !this.selectedDate) {
        uni.showToast({
          title: '请选择票种和日期',
          icon: 'none'
        })
        return
      }

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
      }, 1600)
    }
  }
}
</script>

<style lang="scss" scoped>
.purchase-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.purchase-scroll {
  height: calc(100vh - 120rpx);
  padding: 24rpx 24rpx 0;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.museum-card {
  padding: 24rpx 24rpx 20rpx;
  margin-bottom: 24rpx;
}

.museum-name {
  font-size: $font-xl;
  color: $text-white;
  font-weight: 600;
}

.museum-sub {
  margin-top: 4rpx;
  font-size: $font-sm;
  color: $text-light;
}

.museum-meta {
  margin-top: 12rpx;
}

.meta-item {
  display: block;
  font-size: $font-sm;
  color: $text-light;
}

.section {
  padding: 24rpx 24rpx 20rpx;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: $font-lg;
  color: $text-white;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.ticket-type {
  margin-top: 12rpx;
  padding: 20rpx 20rpx 18rpx;
  border-radius: $radius-md;
  border: 1rpx solid $cr7-border;
  display: flex;
  justify-content: space-between;
}

.ticket-type.active {
  border-color: $cr7-gold;
  box-shadow: $shadow-gold;
}

.ticket-main {
  flex: 1;
}

.ticket-header {
  display: flex;
  align-items: center;
}

.ticket-name {
  font-size: $font-md;
  color: $text-white;
  font-weight: 600;
}

.ticket-tag {
  margin-left: 10rpx;
  font-size: $font-xs;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(217, 0, 27, 0.2);
  color: $cr7-red;
}

.ticket-desc {
  margin-top: 6rpx;
  font-size: $font-sm;
  color: $text-light;
}

.ticket-stock {
  margin-top: 4rpx;
  font-size: $font-xs;
  color: $cr7-warning;
}

.ticket-price {
  margin-left: 16rpx;
  align-self: center;
  text-align: right;
}

.price {
  font-size: $font-lg;
  color: $cr7-gold-light;
  font-weight: 700;
}

.original-price {
  margin-top: 2rpx;
  font-size: $font-xs;
  color: $text-muted;
  text-decoration: line-through;
}

.date-picker {
  margin-top: 10rpx;
  padding: 20rpx;
  border-radius: $radius-md;
  background: $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.date-text {
  font-size: $font-md;
  color: $text-white;
}

.date-arrow {
  font-size: $font-md;
  color: $text-muted;
}

.section-hint {
  margin-top: 10rpx;
  font-size: $font-xs;
  color: $text-muted;
}

.notice-text {
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-light;
  line-height: 1.8;
}

.safe-bottom {
  height: 80rpx;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 120rpx;
  background: $cr7-dark;
  border-top: 1rpx solid $cr7-border;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
}

.price-box {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.price-label {
  font-size: $font-xs;
  color: $text-muted;
}

.total-price {
  font-size: $font-xl;
  color: $cr7-gold-light;
  font-weight: 700;
}

.buy-btn {
  width: 260rpx;
  height: 84rpx;
}

.buy-btn[disabled] {
  opacity: 0.4;
}
</style>
