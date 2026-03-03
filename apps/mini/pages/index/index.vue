<template>
  <view class="home-page">
    <!-- 首页主体（包含导航，滚动时吸顶） -->
    <scroll-view class="home-scroll" scroll-y>
      <!-- 自定义导航：城市 + 品牌徽章 + 消息 -->
      <view class="home-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="navbar-inner">
          <view class="navbar-left">
            <view class="city-switch" @click="openCityPicker">
              <text class="city-name">{{ currentCity }}</text>
              <text class="city-arrow">▽</text>
            </view>

            <view class="navbar-message" @click="goToMessages">
              <text class="icon-message">🔔</text>
              <view v-if="unreadCount > 0" class="badge">{{ unreadCount }}</view>
            </view>
          </view>

          <view class="navbar-center">
            <view class="mini-badge">
              <text class="mini-badge-cr7">CR7</text>
            </view>
            <text class="mini-badge-text">LIFE MUSEUM</text>
          </view>
        </view>
      </view>
      <!-- 顶部 Banner（展馆 / 活动主视觉） -->
      <swiper class="hero-swiper" indicator-dots circular autoplay>
        <swiper-item v-for="(item, index) in heroBanners" :key="index">
          <view class="hero-card">
            <view class="hero-tag">{{ item.tag }}</view>
            <text class="hero-title">{{ item.title }}</text>
            <text class="hero-subtitle">{{ item.subtitle }}</text>
            <view class="hero-meta">
              <text class="meta-item">📍 {{ item.location }}</text>
              <text class="meta-item">🕐 {{ item.date }}</text>
            </view>
          </view>
        </swiper-item>
      </swiper>

      <!-- 热门活动 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">热门活动</text>
          <view class="hot-tabs">
            <text
              v-for="tab in hotTabs"
              :key="tab.key"
              :class="['hot-tab', { active: tab.key === activeHotTab }]"
              @click="changeHotTab(tab.key)"
            >
              {{ tab.label }}
            </text>
          </view>
        </view>

        <view class="card-list">
          <view
            v-for="item in activeHotList"
            :key="item.id"
            class="event-card card-dark"
            @click="openHotItem(item)"
          >
            <view class="event-header">
              <text class="event-museum">{{ item.museum }}</text>
              <text
                class="event-tag"
                :class="[
                  item.status === 'active' ? 'tag-active' : '',
                  item.status === 'countdown' ? 'tag-countdown' : '',
                  item.status === 'ended' ? 'tag-ended' : ''
                ]"
              >
                {{ item.statusText }}
              </text>
            </view>
            <text class="event-title">{{ item.title }}</text>
            <view class="event-meta">
              <text class="meta-item">🕐 {{ item.time }}</text>
              <text class="meta-item">📍 {{ item.location }}</text>
            </view>
            <view class="event-footer">
              <text v-if="item.price" class="event-price">¥{{ item.price }} 起</text>
              <view class="event-cta">
                <text class="cta-text">{{ item.cta || '查看详情' }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- C罗专区：行程日历 / 视频集锦 / 职业生涯 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">C罗专区</text>
        </view>
        <view class="cr7-grid">
          <view
            v-for="entry in cr7Zone"
            :key="entry.key"
            class="cr7-card card-dark"
            @click="openCr7Entry(entry)"
          >
            <view class="cr7-icon">{{ entry.icon }}</view>
            <view class="cr7-info">
              <text class="cr7-title">{{ entry.title }}</text>
              <text class="cr7-desc">{{ entry.desc }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 联名品牌 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">联名品牌</text>
        </view>
        <scroll-view scroll-x class="brand-scroll" show-scrollbar="false">
          <view class="brand-row">
            <view
              v-for="brand in brands"
              :key="brand.name"
              class="brand-chip card-dark"
              @click="openBrand(brand)"
            >
              <view class="brand-logo-circle">
                <text class="brand-initials">{{ brand.initials }}</text>
              </view>
              <view class="brand-text">
                <text class="brand-name">{{ brand.name }}</text>
                <text class="brand-tagline">{{ brand.tagline }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>

    <!-- 城市选择弹层（简版） -->
    <view v-if="showCityPicker" class="city-modal" @click="closeCityPicker">
      <view class="city-panel" @click.stop>
        <text class="city-panel-title">选择城市</text>
        <view class="city-list">
          <view
            v-for="city in cityList"
            :key="city"
            :class="['city-item', { active: city === currentCity }]"
            @click="chooseCity(city)"
          >
            {{ city }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import storage from '@/utils/storage.js'
import { fetchUnreadCount } from '@/services/messages.js'
import {
  fetchHeroBanners,
  fetchHotTickets,
  fetchHotEvents,
  fetchHotWorldcup,
  fetchCr7Zone,
  fetchBrands
} from '@/services/home.js'

export default {
  data() {
    return {
      statusBarHeight: 0,
      currentCity: '北京',
      cityList: ['北京', '上海', '中国香港', '深圳'],
      showCityPicker: false,
      unreadCount: 0,
      heroBanners: [],
      hotTabs: [
        { key: 'ticket', label: '购票' },
        { key: 'event', label: '线下活动' },
        { key: 'worldcup', label: '世界杯' }
      ],
      activeHotTab: 'ticket',
      hotTickets: [],
      hotEvents: [],
      hotWorldcup: [],
      cr7Zone: [],
      brands: []
    }
  },

  computed: {
    activeHotList() {
      if (this.activeHotTab === 'ticket') return this.hotTickets
      if (this.activeHotTab === 'event') return this.hotEvents
      return this.hotWorldcup
    }
  },

  onLoad() {
    const systemInfo = uni.getSystemInfoSync()
    this.statusBarHeight = systemInfo.statusBarHeight || 0
    this.loadHomeData()
  },

  onShow() {
    this.checkLogin()
    this.loadUnreadCount()
  },

  methods: {
    checkLogin() {
      if (!storage.isLoggedIn()) {
        uni.navigateTo({
          url: '/pages/login/login'
        })
      }
    },

    async loadUnreadCount() {
      try {
        const count = await fetchUnreadCount()
        this.unreadCount = count
      } catch (e) {
        console.error('加载未读消息数量失败', e)
      }
    },

    async loadHomeData() {
      try {
        const [
          hero,
          tickets,
          events,
          worldcup,
          cr7Zone,
          brands
        ] = await Promise.all([
          fetchHeroBanners(),
          fetchHotTickets(),
          fetchHotEvents(),
          fetchHotWorldcup(),
          fetchCr7Zone(),
          fetchBrands()
        ])
        this.heroBanners = hero
        this.hotTickets = tickets
        this.hotEvents = events
        this.hotWorldcup = worldcup
        this.cr7Zone = cr7Zone
        this.brands = brands.map((b) => ({
          ...b,
          initials: (b.name || '').slice(0, 2).toUpperCase()
        }))
      } catch (e) {
        console.error('加载首页数据失败', e)
        uni.showToast({
          title: '首页数据加载失败',
          icon: 'none'
        })
      }
    },

    goToMessages() {
      uni.navigateTo({
        url: '/pages/messages/messages'
      })
    },

    openCityPicker() {
      this.showCityPicker = true
    },

    closeCityPicker() {
      this.showCityPicker = false
    },

    chooseCity(city) {
      this.currentCity = city
      this.showCityPicker = false
      // TODO: 根据城市刷新活动数据
    },

    changeHotTab(key) {
      this.activeHotTab = key
    },

    openHotItem(item) {
      if (this.activeHotTab === 'ticket') {
        uni.navigateTo({
          url: `/pages/ticket-purchase/ticket-purchase?id=${item.id}`
        })
      } else if (this.activeHotTab === 'event') {
        uni.navigateTo({
          url: `/pages/event-detail/event-detail?id=${item.id}`
        })
      } else {
        uni.showToast({
          title: '世界杯专题即将上线',
          icon: 'none'
        })
      }
    },

    openCr7Entry(entry) {
      uni.navigateTo({
        url: entry.route
      })
    },

    openBrand(brand) {
      uni.navigateTo({
        url: '/pages/brands/brands'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.home-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.home-navbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.9), rgba(13, 13, 13, 0.6));
}

.navbar-inner {
  height: 88rpx;
  padding: 0 40rpx 8rpx 40rpx;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  position: relative; /* 让中间 logo 可以绝对定位 */
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.city-switch {
  display: flex;
  align-items: center;
}

.city-name {
  font-size: $font-md;
  color: $text-white;
  margin-right: 6rpx;
}

.city-arrow {
  font-size: $font-xs;
  color: $text-muted;
}

.navbar-center {
  position: absolute;
  left: 50%;
  transform: translate(-50%, 6rpx); /* 水平精确居中，略微下移 */
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mini-badge {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: $gradient-gold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-gold;
}

.mini-badge-cr7 {
  font-size: 32rpx;
  font-weight: 700;
  color: $cr7-black;
}

.mini-badge-text {
  margin-top: 4rpx;
  font-size: 18rpx;
  color: $text-light;
  letter-spacing: 3rpx;
}

.navbar-message {
  position: relative;
  display: flex;
  align-items: center;
}

.icon-message {
  font-size: 40rpx;
  color: $text-white;
}

.badge {
  position: absolute;
  top: -6rpx;
  right: -12rpx;
  background: $cr7-red;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 24rpx;
  min-width: 32rpx;
  text-align: center;
}

.home-scroll {
  height: 100vh;
}

.hero-swiper {
  height: 360rpx;
  padding: 0 32rpx;
}

.hero-card {
  margin-top: 8rpx;
  height: 320rpx;
  border-radius: $radius-lg;
  padding: 32rpx;
  background: radial-gradient(circle at 0% 0%, rgba(216, 252, 15, 0.22), transparent 55%), $gradient-dark;
  box-shadow: $shadow-card;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.hero-tag {
  align-self: flex-start;
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  font-size: $font-xs;
  color: $cr7-black;
  background: $gradient-gold;
}

.hero-title {
  margin-top: 20rpx;
  font-size: $font-xxl;
  font-weight: 700;
  color: $text-white;
}

.hero-subtitle {
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-light;
}

.hero-meta {
  margin-top: 24rpx;
}

.meta-item {
  display: block;
  font-size: $font-sm;
  color: $text-light;
}

.section {
  padding: 32rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: $font-lg;
  color: $text-white;
  font-weight: 600;
}

.hot-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 999rpx;
  padding: 4rpx;
}

.hot-tab {
  min-width: 120rpx;
  padding: 8rpx 0;
  text-align: center;
  font-size: $font-sm;
  color: $text-light;
  border-radius: 999rpx;
}

.hot-tab.active {
  background: $gradient-gold;
  color: $cr7-black;
  font-weight: 600;
}

.card-list {
  margin-top: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  padding: 24rpx 24rpx 20rpx;
  box-shadow: $shadow-card;
}

.event-card {
  color: $text-white;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.event-museum {
  font-size: $font-sm;
  color: $text-light;
}

.event-title {
  margin-top: 4rpx;
  font-size: $font-md;
  font-weight: 600;
}

.event-meta {
  margin-top: 10rpx;
}

.event-footer {
  margin-top: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-price {
  font-size: $font-lg;
  color: $cr7-gold-light;
  font-weight: 700;
}

.event-cta {
  padding: 10rpx 28rpx;
  border-radius: 999rpx;
  background: $gradient-gold;
  color: $cr7-black;
  font-weight: 600;
}

.cta-text {
  font-size: $font-sm;
}

.cr7-grid {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.cr7-card {
  display: flex;
  align-items: center;
}

.cr7-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: $radius-lg;
  background: rgba(216, 252, 15, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 20rpx;
}

.cr7-info {
  flex: 1;
}

.cr7-title {
  font-size: $font-md;
  color: $text-white;
}

.cr7-desc {
  margin-top: 4rpx;
  font-size: $font-sm;
  color: $text-light;
}

.brand-scroll {
  white-space: nowrap;
}

.brand-row {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
}

.brand-chip {
  min-width: 320rpx;
  display: flex;
  align-items: center;
}

.brand-logo-circle {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 0% 0%, rgba(216, 252, 15, 0.24), transparent 55%), $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
}

.brand-initials {
  font-size: $font-md;
  color: $cr7-gold-light;
  font-weight: 600;
}

.brand-text {
  flex: 1;
}

.brand-name {
  display: block;
  font-size: $font-md;
  color: $text-white;
}

.brand-tagline {
  display: block;
  margin-top: 4rpx;
  font-size: $font-xs;
  color: $text-muted;
}

.city-modal {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.city-panel {
  width: 100%;
  background: $cr7-card;
  border-top-left-radius: $radius-xl;
  border-top-right-radius: $radius-xl;
  padding: 32rpx 40rpx 40rpx;
}

.city-panel-title {
  font-size: $font-md;
  color: $text-white;
  font-weight: 600;
}

.city-list {
  margin-top: 24rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.city-item {
  padding: 12rpx 32rpx;
  border-radius: 999rpx;
  border: 1rpx solid $cr7-border;
  font-size: $font-sm;
  color: $text-light;
}

.city-item.active {
  border-color: $cr7-gold;
  color: $cr7-gold-light;
  background: rgba(216, 252, 15, 0.12);
}

.safe-bottom {
  height: 80rpx;
}
</style>
