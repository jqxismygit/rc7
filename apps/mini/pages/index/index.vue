<template>
  <view class="container">
    <!-- 自定义导航栏 -->
    <view class="custom-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="navbar-content">
        <text class="navbar-title">C罗超越之境</text>
        <view class="navbar-right" @click="goToMessages">
          <text class="iconfont icon-message"></text>
          <view v-if="unreadCount > 0" class="badge">{{ unreadCount }}</view>
        </view>
      </view>
    </view>

    <!-- 内容区域 -->
    <scroll-view class="content" scroll-y>
      <!-- 轮播图 -->
      <swiper class="banner" indicator-dots circular autoplay>
        <swiper-item v-for="(item, index) in banners" :key="index">
          <image :src="item.cover" mode="aspectFill"></image>
        </swiper-item>
      </swiper>

      <!-- 快捷入口 -->
      <view class="quick-menu">
        <view class="menu-item" @click="goToSchedule">
          <text class="menu-icon">📅</text>
          <text class="menu-text">赛事日程</text>
        </view>
        <view class="menu-item" @click="goToVote">
          <text class="menu-icon">🗳️</text>
          <text class="menu-text">赛事投票</text>
        </view>
        <view class="menu-item" @click="goToGame">
          <text class="menu-icon">🎮</text>
          <text class="menu-text">互动游戏</text>
        </view>
        <view class="menu-item" @click="goToBrands">
          <text class="menu-icon">🏆</text>
          <text class="menu-text">联名品牌</text>
        </view>
      </view>

      <!-- 信息流卡片 -->
      <view class="card-list">
        <view 
          v-for="card in cards" 
          :key="card.id" 
          class="card-item"
          @click="handleCardClick(card)"
        >
          <!-- 展会/赛事卡片 -->
          <view v-if="card.type === 'event'" class="event-card">
            <image :src="card.cover" mode="aspectFill" class="card-cover"></image>
            <view class="card-content">
              <view class="card-tags">
                <text v-for="tag in card.tags" :key="tag" class="tag">{{ tag }}</text>
              </view>
              <text class="card-title">{{ card.title }}</text>
              <view class="card-info">
                <text class="info-item">📍 {{ card.location }}</text>
                <text class="info-item">🕐 {{ card.date }}</text>
              </view>
              <view class="card-footer">
                <text class="price">¥{{ card.price }}起</text>
                <view class="buy-btn">立即购票</view>
              </view>
            </view>
          </view>

          <!-- 视频卡片 -->
          <view v-if="card.type === 'video'" class="video-card">
            <view class="video-wrapper">
              <image :src="card.cover" mode="aspectFill" class="card-cover"></image>
              <view class="play-icon">▶</view>
              <text class="duration">{{ card.duration }}</text>
            </view>
            <view class="card-content">
              <text class="card-title">{{ card.title }}</text>
              <text class="views">{{ formatViews(card.views) }}次观看</text>
            </view>
          </view>

          <!-- 线下活动卡片 -->
          <view v-if="card.type === 'activity'" class="activity-card">
            <image :src="card.cover" mode="aspectFill" class="card-cover"></image>
            <view class="countdown-overlay">
              <text class="countdown-text">距离开始还有</text>
              <text class="countdown-time">{{ formatCountdown(card.countdown) }}</text>
            </view>
            <view class="card-content">
              <text class="card-title">{{ card.title }}</text>
              <view class="card-info">
                <text class="info-item">📍 {{ card.location }}</text>
                <text class="info-item">🕐 {{ card.date }}</text>
              </view>
            </view>
          </view>

          <!-- 图文卡片 -->
          <view v-if="card.type === 'article'" class="article-card">
            <view class="card-content">
              <text class="card-title">{{ card.title }}</text>
              <text class="publish-time">{{ card.publishTime }}</text>
            </view>
            <image :src="card.cover" mode="aspectFill" class="article-cover"></image>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { mockHomeCards, mockMessages } from '@/utils/mockData.js'
import storage from '@/utils/storage.js'

export default {
  data() {
    return {
      statusBarHeight: 0,
      banners: [],
      cards: [],
      unreadCount: 0
    }
  },
  
  onLoad() {
    this.initPage()
  },
  
  onShow() {
    this.checkLogin()
    this.loadUnreadCount()
  },
  
  methods: {
    initPage() {
      // 获取状态栏高度
      const systemInfo = uni.getSystemInfoSync()
      this.statusBarHeight = systemInfo.statusBarHeight || 0
      
      // 加载数据
      this.loadBanners()
      this.loadCards()
    },
    
    checkLogin() {
      if (!storage.isLoggedIn()) {
        uni.showModal({
          title: '提示',
          content: '请先登录',
          success: (res) => {
            if (res.confirm) {
              uni.navigateTo({
                url: '/pages/login/login'
              })
            }
          }
        })
      }
    },
    
    loadBanners() {
      // 使用前3个卡片作为轮播图
      this.banners = mockHomeCards.slice(0, 3)
    },
    
    loadCards() {
      this.cards = mockHomeCards
    },
    
    loadUnreadCount() {
      const unreadMessages = mockMessages.filter(msg => !msg.isRead)
      this.unreadCount = unreadMessages.length
    },
    
    handleCardClick(card) {
      if (card.type === 'event' || card.type === 'activity') {
        uni.navigateTo({
          url: `/pages/event-detail/event-detail?id=${card.id}`
        })
      } else if (card.type === 'video') {
        uni.showToast({
          title: '视频播放功能开发中',
          icon: 'none'
        })
      } else if (card.type === 'article') {
        uni.navigateTo({
          url: `/pages/schedule/schedule`
        })
      }
    },
    
    goToMessages() {
      uni.navigateTo({
        url: '/pages/messages/messages'
      })
    },
    
    goToSchedule() {
      uni.navigateTo({
        url: '/pages/schedule/schedule'
      })
    },
    
    goToVote() {
      uni.navigateTo({
        url: '/pages/vote/vote'
      })
    },
    
    goToGame() {
      uni.navigateTo({
        url: '/pages/game/game'
      })
    },
    
    goToBrands() {
      uni.navigateTo({
        url: '/pages/brands/brands'
      })
    },
    
    formatViews(views) {
      if (views >= 10000) {
        return (views / 10000).toFixed(1) + '万'
      }
      return views
    },
    
    formatCountdown(seconds) {
      const days = Math.floor(seconds / 86400)
      const hours = Math.floor((seconds % 86400) / 3600)
      return `${days}天${hours}小时`
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

.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #fff;
  z-index: 999;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.navbar-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}

.navbar-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.navbar-right {
  position: relative;
  font-size: 44rpx;
}

.badge {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  background: #ff4444;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 8rpx;
  border-radius: 20rpx;
  min-width: 32rpx;
  text-align: center;
}

.content {
  margin-top: 88px;
  height: calc(100vh - 88px);
}

.banner {
  width: 100%;
  height: 400rpx;
}

.banner image {
  width: 100%;
  height: 100%;
}

.quick-menu {
  display: flex;
  background: #fff;
  padding: 40rpx 0;
  margin-bottom: 20rpx;
}

.menu-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.menu-icon {
  font-size: 60rpx;
  margin-bottom: 10rpx;
}

.menu-text {
  font-size: 24rpx;
  color: #666;
}

.card-list {
  padding: 0 30rpx 30rpx;
}

.card-item {
  margin-bottom: 30rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.card-cover {
  width: 100%;
  height: 400rpx;
}

.card-content {
  padding: 30rpx;
}

.card-tags {
  margin-bottom: 10rpx;
}

.tag {
  display: inline-block;
  padding: 4rpx 16rpx;
  background: #ff4444;
  color: #fff;
  font-size: 22rpx;
  border-radius: 8rpx;
  margin-right: 10rpx;
}

.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-bottom: 20rpx;
}

.info-item {
  font-size: 26rpx;
  color: #999;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price {
  font-size: 36rpx;
  color: #ff4444;
  font-weight: bold;
}

.buy-btn {
  padding: 12rpx 40rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
}

.video-wrapper {
  position: relative;
}

.play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100rpx;
  height: 100rpx;
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 40rpx;
}

.duration {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  background: rgba(0,0,0,0.7);
  color: #fff;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.views {
  font-size: 24rpx;
  color: #999;
}

.countdown-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  padding: 40rpx 30rpx 20rpx;
  color: #fff;
  text-align: center;
}

.countdown-text {
  font-size: 24rpx;
  display: block;
}

.countdown-time {
  font-size: 40rpx;
  font-weight: bold;
  display: block;
  margin-top: 10rpx;
}

.article-card {
  display: flex;
  padding: 30rpx;
}

.article-card .card-content {
  flex: 1;
  padding: 0;
  padding-right: 20rpx;
}

.article-cover {
  width: 200rpx;
  height: 150rpx;
  border-radius: 8rpx;
}

.publish-time {
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
  display: block;
}
</style>
