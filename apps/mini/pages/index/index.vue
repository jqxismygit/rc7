<template>
  <view class="home-page">
    <scroll-view class="home-scroll" scroll-y enhanced :show-scrollbar="false">
      <!-- 顶部导航栏 -->
      <view class="home-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="navbar-row">
          <view class="navbar-left">
            <view class="city-switch" @click="openCityPicker">
              <text class="city-name">{{ currentCity }}</text>
              <image src="/static/icons/arrow-down.svg" class="city-arrow-icon" mode="aspectFit" />
            </view>
            <view class="navbar-notification" @click="goToMessages">
              <image src="/static/icons/notification.svg" class="nav-icon" mode="aspectFit" />
              <view v-if="unreadCount > 0" class="notification-dot"></view>
            </view>
          </view>
          <view class="navbar-logo">
            <text class="logo-cr7">CR7</text>
            <text class="logo-life">LIFE</text>
          </view>
        </view>
      </view>

      <!-- Hero 轮播 -->
      <view class="hero-section">
        <swiper class="hero-swiper" circular autoplay :interval="4000" :duration="500" @change="onSwiperChange">
          <swiper-item v-for="(item, index) in heroBanners" :key="index">
            <view class="hero-slide">
              <image :src="item.cover || '/static/images/hero-banner.png'" class="hero-image" mode="aspectFill" />
            </view>
          </swiper-item>
        </swiper>
        <view class="hero-dots">
          <view
            v-for="(item, index) in heroBanners"
            :key="index"
            :class="['hero-dot', { active: index === currentBannerIndex }]"
          ></view>
        </view>
      </view>

      <!-- 热门活动 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">热门活动</text>
        </view>
        <view class="tab-row">
          <view
            v-for="tab in hotTabs"
            :key="tab.key"
            :class="['tab-pill', { active: tab.key === activeHotTab }]"
            @click="changeHotTab(tab.key)"
          >
            <text class="tab-text">{{ tab.label }}</text>
          </view>
        </view>
        <view
          v-for="item in activeHotList"
          :key="item.id"
          class="event-card"
          @click="openHotItem(item)"
        >
          <view class="event-image-wrap">
            <image :src="item.cover || '/static/images/event-card.png'" class="event-image" mode="aspectFill" />
          </view>
          <view class="event-info">
            <text class="event-title">{{ item.title || item.museum }}</text>
            <text class="event-meta">{{ item.time }}</text>
            <text class="event-location">{{ item.location }}</text>
          </view>
          <view class="event-price-area" v-if="item.price">
            <text class="event-price-num">¥{{ item.price }}</text>
            <text class="event-price-unit">起</text>
          </view>
        </view>
      </view>

      <!-- C罗专区 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">C罗专区</text>
        </view>
        <view class="zone-list">
          <view
            v-for="entry in cr7Zone"
            :key="entry.key"
            class="zone-card"
            @click="openCr7Entry(entry)"
          >
            <view class="zone-icon-wrap">
              <image :src="getZoneIcon(entry.key)" class="zone-icon" mode="aspectFit" />
            </view>
            <view class="zone-text">
              <text class="zone-title">{{ entry.title }}</text>
              <text class="zone-desc">{{ entry.desc }}</text>
            </view>
            <image src="/static/icons/arrow-right.svg" class="zone-arrow" mode="aspectFit" />
          </view>
        </view>
      </view>

      <!-- 品牌联名 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">品牌联名</text>
          <text class="section-link" @click="openBrandAll">查看全部</text>
        </view>
        <view class="brand-grid">
          <view
            v-for="brand in brands"
            :key="brand.id"
            class="brand-card"
            @click="openBrand(brand)"
          >
            <view class="brand-logo-area">
              <image :src="brand.logo" class="brand-logo-img" mode="aspectFit" />
            </view>
            <text class="brand-name">{{ brand.name }}</text>
            <text class="brand-tagline">{{ brand.tagline }}</text>
          </view>
        </view>
      </view>

      <!-- 底部占位 -->
      <view class="bottom-spacer"></view>
    </scroll-view>

    <!-- 城市选择弹层 -->
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
      currentCity: '上海',
      cityList: ['北京', '上海', '中国香港', '深圳'],
      showCityPicker: false,
      unreadCount: 0,
      currentBannerIndex: 0,
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
        uni.navigateTo({ url: '/pages/login/login' })
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
        const [hero, tickets, events, worldcup, cr7Zone, brandList] = await Promise.all([
          fetchHeroBanners(),
          fetchHotTickets(),
          fetchHotEvents(),
          fetchHotWorldcup(),
          fetchCr7Zone(),
          fetchBrands()
        ])
        this.heroBanners = hero.length ? hero : [{ cover: '' }, { cover: '' }]
        this.hotTickets = tickets
        this.hotEvents = events
        this.hotWorldcup = worldcup
        this.cr7Zone = cr7Zone
        this.brands = brandList.map((b) => ({
          ...b,
          tagline: b.description || '官方合作品牌'
        }))
      } catch (e) {
        console.error('加载首页数据失败', e)
        uni.showToast({ title: '首页数据加载失败', icon: 'none' })
      }
    },

    onSwiperChange(e) {
      this.currentBannerIndex = e.detail.current
    },

    getZoneIcon(key) {
      const map = {
        calendar: '/static/icons/calendar.svg',
        highlights: '/static/icons/video.svg',
        career: '/static/icons/crown.svg'
      }
      return map[key] || '/static/icons/calendar.svg'
    },

    goToMessages() {
      uni.navigateTo({ url: '/pages/messages/messages' })
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
    },

    changeHotTab(key) {
      this.activeHotTab = key
    },

    openHotItem(item) {
      if (this.activeHotTab === 'ticket') {
        uni.navigateTo({ url: `/pages/ticket-purchase/ticket-purchase?id=${item.id}` })
      } else if (this.activeHotTab === 'event') {
        uni.navigateTo({ url: `/pages/event-detail/event-detail?id=${item.id}` })
      } else {
        uni.showToast({ title: '世界杯专题即将上线', icon: 'none' })
      }
    },

    openCr7Entry(entry) {
      uni.navigateTo({ url: entry.route })
    },

    openBrandAll() {
      uni.navigateTo({ url: '/pages/brands/brands' })
    },

    openBrand(brand) {
      uni.navigateTo({ url: '/pages/brands/brands' })
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

.home-scroll {
  height: 100vh;
}

/* 导航栏 */
.home-navbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: $cr7-black;
}

.navbar-row {
  height: 96rpx;
  padding: 0 48rpx;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  position: relative;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.city-switch {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.city-name {
  font-size: $font-xs;
  color: $text-white;
}

.city-arrow-icon {
  width: 36rpx;
  height: 36rpx;
}

.navbar-notification {
  position: relative;
}

.nav-icon {
  width: 42rpx;
  height: 42rpx;
}

.notification-dot {
  position: absolute;
  top: 2rpx;
  right: 2rpx;
  width: 14rpx;
  height: 14rpx;
  background: $cr7-red;
  border-radius: 50%;
}

.navbar-logo {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.logo-cr7 {
  font-size: 38rpx;
  font-weight: 900;
  color: $text-white;
  letter-spacing: 2rpx;
}

.logo-life {
  font-size: 28rpx;
  font-weight: 400;
  color: $text-white;
  letter-spacing: 4rpx;
}

/* Hero 轮播 */
.hero-section {
  padding: 16rpx 48rpx 0;
  position: relative;
}

.hero-swiper {
  height: 460rpx;
  border-radius: $radius-lg;
  overflow: hidden;
}

.hero-slide {
  width: 100%;
  height: 100%;
  border-radius: $radius-lg;
  overflow: hidden;
}

.hero-image {
  width: 100%;
  height: 100%;
  border-radius: $radius-lg;
}

.hero-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin-top: 16rpx;
}

.hero-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: all 0.3s;

  &.active {
    width: 40rpx;
    border-radius: 12rpx;
    background: $cr7-gold;
  }
}

/* 区块通用 */
.section {
  padding: 40rpx 48rpx 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 46rpx;
  color: $text-white;
  font-weight: 700;
}

.section-link {
  font-size: $font-base;
  color: $cr7-gold;
}

/* 标签 */
.tab-row {
  display: flex;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.tab-pill {
  padding: 12rpx 48rpx;
  border-radius: 58rpx;
  background: $cr7-dark;

  &.active {
    background: $cr7-gold;
    .tab-text {
      color: $cr7-black;
    }
  }
}

.tab-text {
  font-size: $font-xs;
  color: $text-white;
}

/* 活动卡片 */
.event-card {
  background: $cr7-dark;
  border-radius: 32rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.event-image-wrap {
  width: 100%;
  height: 460rpx;
  overflow: hidden;
}

.event-image {
  width: 100%;
  height: 100%;
}

.event-info {
  padding: 24rpx 28rpx 0;
}

.event-title {
  display: block;
  font-size: 42rpx;
  font-weight: 700;
  color: $text-white;
  margin-bottom: 8rpx;
}

.event-meta {
  display: block;
  font-size: $font-xs;
  color: $text-light;
  margin-bottom: 4rpx;
}

.event-location {
  display: block;
  font-size: $font-xs;
  color: $text-light;
}

.event-price-area {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  padding: 16rpx 28rpx 28rpx;
  gap: 4rpx;
}

.event-price-num {
  font-size: 56rpx;
  font-weight: 700;
  color: $text-white;
}

.event-price-unit {
  font-size: $font-xs;
  color: $text-light;
}

/* C罗专区 */
.zone-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.zone-card {
  display: flex;
  align-items: center;
  background: $cr7-dark;
  border-radius: 32rpx;
  padding: 20rpx;
}

.zone-icon-wrap {
  width: 140rpx;
  height: 140rpx;
  background: $cr7-card;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 28rpx;
  flex-shrink: 0;
}

.zone-icon {
  width: 56rpx;
  height: 56rpx;
}

.zone-text {
  flex: 1;
}

.zone-title {
  display: block;
  font-size: 40rpx;
  font-weight: 500;
  color: $text-white;
  margin-bottom: 8rpx;
}

.zone-desc {
  display: block;
  font-size: $font-xs;
  color: $text-light;
}

.zone-arrow {
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
  opacity: 0.4;
}

/* 品牌联名 */
.brand-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}

.brand-card {
  width: calc(50% - 12rpx);
  background: $cr7-dark;
  border-radius: 36rpx;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand-logo-area {
  width: 100%;
  height: 220rpx;
  background: $cr7-card;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.brand-logo-img {
  width: 120rpx;
  height: 120rpx;
}

.brand-name {
  display: block;
  font-size: 40rpx;
  font-weight: 500;
  color: $text-white;
  text-align: center;
  margin-bottom: 4rpx;
}

.brand-tagline {
  display: block;
  font-size: $font-xs;
  color: $text-light;
  text-align: center;
}

/* 底部占位 */
.bottom-spacer {
  height: 260rpx;
}

/* 城市选择弹层 */
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
  background: $cr7-dark;
  border-top-left-radius: $radius-xl;
  border-top-right-radius: $radius-xl;
  padding: 40rpx 48rpx 60rpx;
}

.city-panel-title {
  font-size: $font-lg;
  color: $text-white;
  font-weight: 600;
  margin-bottom: 32rpx;
}

.city-list {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.city-item {
  padding: 16rpx 40rpx;
  border-radius: 999rpx;
  background: $cr7-card;
  font-size: $font-sm;
  color: $text-light;

  &.active {
    background: rgba(216, 252, 15, 0.15);
    color: $cr7-gold;
    border: 2rpx solid $cr7-gold;
  }
}
</style>
