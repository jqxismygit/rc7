<template>
  <view class="purchase-page">
    <!-- 悬浮导航栏 -->
    <view class="nav-bar safe-area-top">
      <view class="nav-back" @click="goBack">
        <text class="nav-back-icon">‹</text>
      </view>
      <text class="nav-title">购票</text>
      <view class="nav-placeholder"></view>
    </view>

    <scroll-view class="purchase-scroll" scroll-y>
      <!-- 背景大图区域 -->
      <view class="hero-section">
        <image
          class="hero-bg"
          src="/static/images/event-card.jpg"
          mode="aspectFill"
        />
        <view class="hero-gradient"></view>

        <!-- 标题/副标题叠加在图片底部 -->
        <view class="hero-bottom">
          <text class="hero-title">C罗博物馆 • 上海博物馆门票</text>
          <text class="hero-sub">亚洲首个CR7@LIFE 沉浸式博物馆</text>
        </view>
      </view>

      <!-- 信息区域 -->
      <view class="info-section">
        <view class="info-row info-row-time">
          <text class="info-icon">⏱</text>
          <view class="info-text-col">
            <text class="info-text">2026.05.01-12.31</text>
            <text class="info-text info-text-indent">10:00 AM - 22:00 PM(最晚入场21:00)</text>
          </view>
        </view>
        <view class="info-row">
          <text class="info-icon">📍</text>
          <text class="info-text">上海市黄浦区王府井大街123号</text>
        </view>
        <view class="info-row">
          <text class="info-icon">📞</text>
          <text class="info-text">021-8888888</text>
        </view>
      </view>

      <!-- 描述卡片 -->
      <view class="desc-card">
        <view class="desc-card-bg"></view>
        <view class="desc-card-content">
          <text class="desc-main">亚洲史上首个 CR7® LIFE 博物馆落户上海！2025年 7 月博物馆于上海开幕。</text>
          <text class="desc-sub">博物馆内球迷可以近距离看到传奇球员C罗的冠军奖杯...</text>
          <text class="desc-link">查看更多</text>
        </view>
      </view>

      <!-- 选择票种标题 + 日期 chips -->
      <view class="ticket-section">
        <text class="section-title">选择票种</text>
        <view class="date-chips">
          <block v-for="chip in dateChips" :key="chip.key">
            <!-- 所有日期：使用原生日期选择器 -->
            <picker
              v-if="chip.key === 'all'"
              mode="date"
              @change="onAllDateChange"
            >
              <view
                class="date-chip"
                :class="[
                  chip.wide ? 'date-chip-wide' : '',
                  activeDateKey === chip.key ? 'active' : ''
                ]"
              >
                <text v-if="chip.icon" class="chip-icon">📅</text>
                <text class="chip-label">{{ chip.label }}</text>
              </view>
            </picker>

            <!-- 其他日期：普通 chip 点击切换 --> 
            <view
              v-else
              class="date-chip"
              :class="[
                chip.wide ? 'date-chip-wide' : '',
                activeDateKey === chip.key ? 'active' : ''
              ]"
              @click="onChipClick(chip)"
            >
              <text v-if="chip.icon" class="chip-icon">📅</text>
              <text class="chip-label">{{ chip.label }}</text>
            </view>
          </block>
        </view>
      </view>

      <!-- 票种列表 -->
      <view class="ticket-list">
        <view
          v-for="ticket in ticketTypes"
          :key="ticket.id"
          class="ticket-card"
          :class="{ active: selectedTicket && selectedTicket.id === ticket.id }"
          @click="selectTicket(ticket)"
        >
          <!-- 限量 tag 绝对定位右上角 -->
          <view v-if="ticket.tag" class="ticket-tag-badge">
            <text class="ticket-tag-text">{{ ticket.tag }}</text>
          </view>

          <view class="ticket-card-inner">
            <view class="ticket-left">
              <text class="ticket-name">{{ ticket.name }}</text>
              <text class="ticket-desc">{{ ticket.description }}</text>
            </view>
            <view class="ticket-right">
              <text
                v-if="ticket.originalPrice > ticket.price"
                class="ticket-price-origin"
              >￥{{ ticket.originalPrice }}</text>
              <text class="ticket-price-now" :class="{ 'price-gold': ticket.originalPrice > ticket.price }">¥{{ ticket.price }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 购票须知入口 -->
      <view class="notice-entry">
        <text class="notice-icon">ⓘ</text>
        <text class="notice-text">购票须知</text>
      </view>

      <!-- 底部占位 -->
      <view class="scroll-bottom-space"></view>
    </scroll-view>

    <!-- 底部固定栏 -->
    <view class="bottom-bar safe-area-bottom">
      <view class="bottom-bar-inner">
        <view class="price-box">
          <text class="price-label">合计</text>
          <text class="total-price">¥{{ totalPrice }}</text>
        </view>
        <button
          class="btn-gold buy-btn"
          :disabled="!selectedTicket"
          @click="handlePurchase"
        >
          立即购买
        </button>
      </view>
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
      museumLocation: '上海市黄浦区王府井大街123号',
      ticketTypes: [],
      selectedTicket: null,
      selectedDate: '',
      activeDateKey: 'today'
    }
  },

  computed: {
    totalPrice() {
      return this.selectedTicket ? this.selectedTicket.price : 199
    },

    dateChips() {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)

      const formatMonth = (d) => `${d.getMonth() + 1}月${d.getDate()}日`

      return [
        { key: 'today', label: '今天', date: this.formatDate(today) },
        { key: 'tomorrow', label: '明天', date: this.formatDate(tomorrow) },
        { key: 'specific', label: formatMonth(today) },
        { key: 'all', label: '所有日期', icon: true, wide: true }
      ]
    }
  },

  onLoad(options) {
    this.eventId = options.eventId
    this.loadEventInfo()
    this.loadTicketTypes()
  },

  methods: {
    goBack() {
      if (getCurrentPages().length > 1) {
        uni.navigateBack()
      } else {
        uni.switchTab({ url: '/pages/index/index' })
      }
    },

    formatDate(d) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    },

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
        uni.showToast({ title: '该票种已售罄', icon: 'none' })
      }
    },

    onChipClick(chip) {
      this.activeDateKey = chip.key
      if (chip.date) {
        this.selectedDate = chip.date
      } else {
        this.selectedDate = ''
      }
    },

    onAllDateChange(e) {
      this.selectedDate = e.detail.value
      this.activeDateKey = 'all'
    },

    handlePurchase() {
      if (!this.selectedTicket) {
        uni.showToast({ title: '请选择票种', icon: 'none' })
        return
      }

      const query = [
        `eventName=${encodeURIComponent('C罗博物馆 CR7LIFE上海博物馆门票')}`,
        `museumLocation=${encodeURIComponent(this.museumLocation)}`,
        `visitDate=${this.selectedDate}`,
        `ticketName=${encodeURIComponent(this.selectedTicket.name)}`,
        `quantity=1`,
        `amount=${this.totalPrice}`
      ].join('&')

      uni.navigateTo({
        url: `/pages/order-confirm/order-confirm?${query}`
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.purchase-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
  position: relative;
}

.purchase-scroll {
  width: 100%;
  height: 100vh;
}

/* ===== 顶部大图区域 ===== */
.hero-section {
  position: relative;
  width: 100%;
  height: 570rpx;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.hero-gradient {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(9, 10, 7, 0) 40%, $cr7-black 96%);
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

.hero-bottom {
  position: absolute;
  left: 35rpx;
  right: 35rpx;
  bottom: 20rpx;
  z-index: 2;
}

.hero-title {
  display: block;
  font-size: 48rpx;
  color: $text-white;
  font-weight: 700;
  line-height: 1.1;
}

.hero-sub {
  display: block;
  margin-top: 10rpx;
  font-size: $font-xs;
  color: $text-light;
}

/* ===== 信息区域 ===== */
.info-section {
  padding: 24rpx 35rpx 0;
}

.info-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.info-row-time {
  align-items: flex-start;
}

.info-icon {
  width: 44rpx;
  flex-shrink: 0;
  font-size: 24rpx;
  line-height: 38rpx;
}

.info-text-col {
  display: flex;
  flex-direction: column;
}

.info-text {
  font-size: 26rpx;
  color: $text-white;
  line-height: 38rpx;
}

.info-text-indent {
  padding-left: 0;
}

/* ===== 描述卡片 ===== */
.desc-card {
  margin: 28rpx 27rpx 0;
  border-radius: $radius-lg;
  overflow: hidden;
  position: relative;
  background: $cr7-dark;
}

.desc-card-bg {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, $cr7-dark 0%, rgba(22, 23, 20, 0) 100%);
  z-index: 1;
}

.desc-card-content {
  position: relative;
  z-index: 2;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
}

.desc-main {
  font-size: 32rpx;
  color: $text-white;
  font-weight: 500;
  line-height: 1.5;
}

.desc-sub {
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-light;
  line-height: 1.5;
}

.desc-link {
  margin-top: 16rpx;
  font-size: $font-xs;
  color: $cr7-gold;
  text-decoration: underline;
}

/* ===== 选择票种区域 ===== */
.ticket-section {
  padding: 32rpx 30rpx 0;
}

.section-title {
  font-size: 38rpx;
  color: $text-white;
  font-weight: 400;
  line-height: 54rpx;
  margin-bottom: $spacing-md;
  display: block;
}

.date-chips {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.date-chip {
  width: 142rpx;
  height: 64rpx;
  border-radius: 21rpx;
  background: $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.date-chip-wide {
  width: 197rpx;
}

.chip-icon {
  font-size: 24rpx;
  margin-right: 10rpx;
}

.chip-label {
  font-size: 24rpx;
  color: $text-white;
}

.date-chip.active {
  background: $cr7-gold;
}

.date-chip.active .chip-label {
  color: $cr7-black;
  font-weight: 600;
}

/* ===== 票种列表 ===== */
.ticket-list {
  padding: 24rpx 30rpx 0;
}

.ticket-card {
  position: relative;
  background: $cr7-dark;
  border-radius: $radius-lg;
  padding: 30rpx;
  margin-bottom: 23rpx;
  overflow: visible;
}

.ticket-card.active {
  border: 2rpx solid $cr7-gold;
}

.ticket-tag-badge {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  background: $cr7-gold;
  border-radius: 999rpx;
  padding: 0 15rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36rpx;
}

.ticket-tag-text {
  font-size: 19rpx;
  color: #0F2316;
  font-weight: 500;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.ticket-card-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.ticket-name {
  font-size: 30rpx;
  color: $text-white;
  font-weight: 700;
  line-height: 46rpx;
}

.ticket-desc {
  font-size: 24rpx;
  color: $text-disabled;
  line-height: 38rpx;
}

.ticket-right {
  margin-left: $spacing-sm;
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
}

.ticket-price-origin {
  font-size: 28rpx;
  color: $text-disabled;
  text-decoration: line-through;
  margin-right: 8rpx;
}

.ticket-price-now {
  font-size: 30rpx;
  color: $text-white;
  font-weight: 700;
  line-height: 46rpx;
}

.ticket-price-now.price-gold {
  color: $cr7-gold;
}

/* ===== 购票须知入口 ===== */
.notice-entry {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8rpx 30rpx 20rpx;
}

.notice-icon {
  font-size: 24rpx;
  color: $text-light;
  margin-right: 8rpx;
}

.notice-text {
  font-size: 24rpx;
  color: $text-light;
}

/* ===== 底部占位 ===== */
.scroll-bottom-space {
  height: 200rpx;
}

/* ===== 底部固定栏 ===== */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  border-top: 1rpx solid $cr7-border;
  background: $cr7-dark;
  // padding: 15rpx 30rpx 12rpx;
}

.bottom-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  // padding: 33rpx 30rpx 62rpx;
}

.price-box {
  display: flex;
  flex-direction: column;
}

.price-label {
  font-size: 23rpx;
  color: $text-light;
  letter-spacing: 1rpx;
  text-transform: uppercase;
  line-height: 30rpx;
}

.total-price {
  font-size: 46rpx;
  color: $cr7-gold;
  font-weight: 700;
  line-height: 62rpx;
}

.buy-btn {
  width: 518rpx;
  height: 98rpx;
  font-size: 30rpx;
  font-weight: 500;
}

.buy-btn[disabled] {
  opacity: 0.4;
}
</style>
