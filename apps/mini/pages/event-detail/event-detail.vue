<template>
  <view class="event-page">
    <scroll-view class="event-scroll" scroll-y>
      <!-- 顶部主卡 -->
      <view class="hero-card card-dark">
        <view class="hero-tag-row">
          <text
            v-for="tag in event.tags || []"
            :key="tag"
            class="hero-tag"
          >
            {{ tag }}
          </text>
        </view>
        <text class="hero-title">{{ event.title }}</text>
        <view class="hero-meta">
          <text class="meta-item">📍 {{ event.location }}</text>
          <text class="meta-item">🕐 {{ event.date }}</text>
        </view>
        <view class="hero-price-row">
          <text class="price-label">票价</text>
          <text class="price">¥{{ event.price }} 起</text>
        </view>
      </view>

      <!-- 活动详情 -->
      <view class="section card-dark">
        <text class="section-title">活动详情</text>
        <text class="section-desc">
          {{ event.description || '这是一场与传奇球星 C罗 相关的线下主题活动。' }}
        </text>
        <view class="detail-box">
          <text class="detail-text">{{ eventDetailIntro }}</text>
        </view>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>

    <!-- 底部购票栏 -->
    <view class="bottom-bar safe-area-bottom">
      <view class="price-info">
        <text class="price-label">票价</text>
        <text class="price">¥{{ event.price }} 起</text>
      </view>
      <button class="btn-gold buy-btn" @click="goToPurchase">
        立即购票
      </button>
    </view>
  </view>
</template>

<script>
import { mockHomeCards } from '@/utils/mockData.js'

const EVENT_DETAIL_INTRO = `• 现场互动问答环节
• 签名合影机会
• 独家周边商品展示
• 精彩视频回顾与现场抽奖

名额有限，先到先得，请提前完成报名与购票。`

export default {
  data() {
    return {
      eventId: '',
      event: {},
      eventDetailIntro: EVENT_DETAIL_INTRO
    }
  },

  onLoad(options) {
    this.eventId = options.id
    this.loadEventDetail()
  },

  methods: {
    loadEventDetail() {
      const event = mockHomeCards.find(item => item.id == this.eventId)
      if (event) {
        this.event = event
      }
    },

    goToPurchase() {
      uni.navigateTo({
        url: `/pages/ticket-purchase/ticket-purchase?eventId=${this.eventId}`
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.event-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.event-scroll {
  height: calc(100vh - 120rpx);
  padding: 24rpx;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.hero-card {
  padding: 24rpx 24rpx 20rpx;
  margin-bottom: 24rpx;
}

.hero-tag-row {
  flex-direction: row;
  margin-bottom: 8rpx;
}

.hero-tag {
  display: inline-block;
  margin-right: 10rpx;
  margin-bottom: 4rpx;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: $font-xs;
  background: rgba(201, 168, 76, 0.2);
  color: $cr7-gold-light;
}

.hero-title {
  font-size: $font-xxl;
  color: $text-white;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.hero-meta {
  margin-bottom: 16rpx;
}

.meta-item {
  display: block;
  font-size: $font-sm;
  color: $text-light;
}

.hero-price-row {
  padding-top: 12rpx;
  border-top: 1rpx solid $cr7-border;
  display: flex;
  align-items: baseline;
}

.price-label {
  font-size: $font-sm;
  color: $text-muted;
  margin-right: 6rpx;
}

.price {
  font-size: $font-xl;
  color: $cr7-gold-light;
  font-weight: 700;
}

.section {
  padding: 24rpx 24rpx 20rpx;
}

.section-title {
  font-size: $font-lg;
  color: $text-white;
  font-weight: 600;
  margin-bottom: 8rpx;
}

.section-desc {
  font-size: $font-sm;
  color: $text-light;
  margin-bottom: 16rpx;
}

.detail-box {
  padding: 20rpx;
  border-radius: $radius-md;
  background: $cr7-dark;
}

.detail-text {
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
  height: 120rpx;
  background: $cr7-dark;
  border-top: 1rpx solid $cr7-border;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
}

.price-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.buy-btn {
  width: 260rpx;
  height: 84rpx;
}
</style>
