<template>
  <view class="container">
    <scroll-view class="content" scroll-y>
      <!-- 封面图 -->
      <image :src="event.cover" mode="aspectFill" class="cover"></image>
      
      <!-- 活动信息 -->
      <view class="info-section">
        <view class="tags">
          <text v-for="tag in event.tags" :key="tag" class="tag">{{ tag }}</text>
        </view>
        <text class="title">{{ event.title }}</text>
        
        <view class="info-item">
          <text class="info-icon">📍</text>
          <text class="info-text">{{ event.location }}</text>
        </view>
        
        <view class="info-item">
          <text class="info-icon">🕐</text>
          <text class="info-text">{{ event.date }}</text>
        </view>
        
        <view class="price-section">
          <text class="price-label">票价</text>
          <text class="price">¥{{ event.price }}起</text>
        </view>
      </view>
      
      <!-- 活动详情 -->
      <view class="detail-section">
        <text class="section-title">活动详情</text>
        <text class="description">{{ event.description }}</text>
        
        <view class="detail-content">
          <text class="detail-text">
            这是一场与传奇球星C罗面对面交流的难得机会。活动将包括：
            
            • 现场互动问答环节
            • 签名合影机会
            • 独家周边商品展示
            • 精彩视频回顾
            
            名额有限，先到先得！
          </text>
        </view>
      </view>
    </scroll-view>
    
    <!-- 底部购票栏 -->
    <view class="bottom-bar">
      <view class="price-info">
        <text class="price-label">票价</text>
        <text class="price">¥{{ event.price }}起</text>
      </view>
      <button class="buy-btn" @click="goToPurchase">立即购票</button>
    </view>
  </view>
</template>

<script>
import { mockHomeCards } from '@/utils/mockData.js'

export default {
  data() {
    return {
      eventId: '',
      event: {}
    }
  },
  
  onLoad(options) {
    this.eventId = options.id
    this.loadEventDetail()
  },
  
  methods: {
    loadEventDetail() {
      // 从假数据中查找对应的活动
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

<style scoped>
.container {
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
}

.content {
  height: calc(100vh - 120rpx);
}

.cover {
  width: 100%;
  height: 500rpx;
}

.info-section {
  background: #fff;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.tags {
  margin-bottom: 20rpx;
}

.tag {
  display: inline-block;
  padding: 8rpx 20rpx;
  background: #ff4444;
  color: #fff;
  font-size: 22rpx;
  border-radius: 8rpx;
  margin-right: 10rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 30rpx;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.info-icon {
  font-size: 32rpx;
  margin-right: 10rpx;
}

.info-text {
  font-size: 28rpx;
  color: #666;
}

.price-section {
  display: flex;
  align-items: baseline;
  margin-top: 30rpx;
  padding-top: 30rpx;
  border-top: 1px solid #f0f0f0;
}

.price-label {
  font-size: 26rpx;
  color: #999;
  margin-right: 10rpx;
}

.price {
  font-size: 40rpx;
  color: #ff4444;
  font-weight: bold;
}

.detail-section {
  background: #fff;
  padding: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.description {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
  display: block;
  margin-bottom: 30rpx;
}

.detail-content {
  background: #f8f8f8;
  padding: 30rpx;
  border-radius: 12rpx;
}

.detail-text {
  font-size: 26rpx;
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

.price-info {
  flex: 1;
  display: flex;
  flex-direction: column;
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
</style>
