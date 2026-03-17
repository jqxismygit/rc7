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
          <view class="event-info-overlay">
            <view class="event-info-left">
              <text class="event-title">{{ item.title || item.museum }}</text>
              <text class="event-meta">{{ item.time }}·{{ item.location }}</text>
            </view>
            <view class="event-price-area" v-if="item.price">
              <text class="event-price-num">¥{{ item.price }}</text>
              <text class="event-price-unit">起</text>
            </view>
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
import createTabBarMixin from '@/mixins/tabBar.js'

export default {
  mixins: [createTabBarMixin(0)],
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
@import '@/uni.scss';
/* 设计稿 750px 画布，1px = 1rpx 严格对应 */

.home-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.home-scroll {
  height: 100vh;
  box-sizing: border-box;
}

/* 导航栏 - 设计稿 Title With Status bar 下沿到内容区 35px 间距 */
.home-navbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: $cr7-black;
}

.navbar-row {
  height: 114rpx; /* 设计稿 117.16 到顶约 35+ 区域，取 114 与状态栏协调 */
  padding: 0 35rpx;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  position: relative;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.city-switch {
  display: flex;
  align-items: center;
  gap: 2rpx;
}

.city-name {
  font-size: 24rpx;
  color: $text-white;
  line-height: 38rpx;
}

.city-arrow-icon {
  width: 42rpx;
  height: 42rpx;
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
  top: 0;
  right: 0;
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
  font-size: 36rpx;
  font-weight: 700;
  color: $text-white;
  letter-spacing: 2rpx;
}

.logo-life {
  font-size: 24rpx;
  font-weight: 400;
  color: $cr7-gold;
  letter-spacing: 4rpx;
}

/* Hero - 设计稿 Frame 1000003725: 679.9×350.47，指示器在图片内部底部 */
.hero-section {
  padding: 0 35rpx;
  margin-top: 18rpx;
  position: relative;
}

.hero-swiper {
  width: 100%;
  height: 350rpx;
  border-radius: 0;
  overflow: hidden;
}

.hero-slide {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.hero-image {
  width: 100%;
  height: 100%;
}

/* 指示点 - 叠在 banner 内部底部，设计稿 40×12 长条 + 12 圆点 */
.hero-dots {
  position: absolute;
  left: 35rpx;
  right: 35rpx;
  bottom: 24rpx;
  height: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  pointer-events: none;
}

.hero-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: all 0.2s;

  &.active {
    width: 40rpx;
    border-radius: 12rpx;
    background: $cr7-gold;
  }
}

/* 主内容区 - 设计稿 left 35px, width 679.9px，区块间距 54px，1px=1rpx */
.section {
  padding: 0 35rpx;
  width: 100%;
  box-sizing: border-box;
  margin-top: 54rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 35rpx;
}

.section-title {
  font-size: 35rpx;
  font-weight: 600;
  color: $text-white;
  line-height: 52rpx;
}

.section-link {
  font-size: 29rpx;
  color: $cr7-gold;
  line-height: 42rpx;
}

/* 标签 - 设计稿 Tag Small 高 60, 圆角 29, 内边距 49×10.5 */
.tab-row {
  display: flex;
  gap: 21rpx;
  margin-bottom: 35rpx;
}

.tab-pill {
  padding: 10rpx 49rpx;
  height: 60rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 29rpx;
  background: $cr7-dark;

  &.active {
    background: $cr7-gold;
    .tab-text {
      color: $cr7-black;
    }
  }
}

.tab-text {
  font-size: 24rpx;
  color: $text-white;
  line-height: 38rpx;
}

/* 活动卡片 - 设计稿 679.9×492.4，整卡固定尺寸，底部叠字 */
.event-card {
  width: 100%;
  height: 492rpx;
  max-width: 680rpx;
  position: relative;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.event-image-wrap {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.event-image {
  width: 100%;
  height: 100%;
}

/* 底部信息叠在图片上，设计稿 inset 75.44% 3.22% 4.27% 3.22% */
.event-info-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 21rpx 22rpx 21rpx 22rpx;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.75) 100%);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16rpx;
}

.event-info-left {
  flex: 1;
  min-width: 0;
}

.event-title {
  display: block;
  font-size: 31rpx;
  font-weight: 600;
  color: $text-white;
  line-height: 47rpx;
  margin-bottom: 7rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-meta {
  display: block;
  font-size: 24rpx;
  color: $text-light;
  line-height: 38rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-price-area {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
  gap: 4rpx;
}

.event-price-num {
  font-size: 42rpx;
  font-weight: 600;
  color: $text-white;
  line-height: 63rpx;
}

.event-price-unit {
  font-size: 24rpx;
  color: $text-light;
  line-height: 42rpx;
}

/* C罗专区 - 设计稿每行 133.18 高，圆角 16，内边距 14，图标框 105.14 圆角 10 */
.zone-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.zone-card {
  display: flex;
  align-items: center;
  height: 133rpx;
  background: $cr7-dark;
  border-radius: 16rpx;
  padding: 0 14rpx;
  box-sizing: border-box;
}

.zone-icon-wrap {
  width: 105rpx;
  height: 105rpx;
  background: $cr7-card;
  border-radius: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 21rpx;
  flex-shrink: 0;
}

.zone-icon {
  width: 42rpx;
  height: 42rpx;
}

.zone-text {
  flex: 1;
  min-width: 0;
}

.zone-title {
  display: block;
  font-size: 29rpx;
  font-weight: 500;
  color: $text-white;
  line-height: 42rpx;
  margin-bottom: 7rpx;
}

.zone-desc {
  display: block;
  font-size: 24rpx;
  color: $text-light;
  line-height: 38rpx;
}

.zone-arrow {
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
}

/* 品牌联名 - 设计稿 327.4×300.4 卡片，圆角 28，图区圆角 17.5 */
.brand-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}

.brand-card {
  width: calc((100% - 24rpx) / 2);
  max-width: 328rpx;
  height: 300rpx;
  background: $cr7-dark;
  border-radius: 28rpx;
  padding: 14rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand-logo-area {
  width: 100%;
  height: 163rpx;
  background: $cr7-card;
  border-radius: 17rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 21rpx;
  flex-shrink: 0;
}

.brand-logo-img {
  width: 100%;
  height: 100%;
}

.brand-name {
  display: block;
  font-size: 29rpx;
  font-weight: 500;
  color: $text-white;
  text-align: center;
  line-height: 42rpx;
  margin-bottom: 2rpx;
}

.brand-tagline {
  display: block;
  font-size: 24rpx;
  color: $text-light;
  text-align: center;
  line-height: 38rpx;
}

/* 底部占位 - 为底部导航留空 */
.bottom-spacer {
  height: 260rpx;
}

/* 城市选择弹层 - 设计稿风格 1:1 */
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
  border-top-left-radius: 32rpx;
  border-top-right-radius: 32rpx;
  padding: 40rpx 35rpx 60rpx;
  box-sizing: border-box;
}

.city-panel-title {
  font-size: 30rpx;
  color: $text-white;
  font-weight: 600;
  margin-bottom: 32rpx;
}

.city-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.city-item {
  padding: 12rpx 32rpx;
  border-radius: 40rpx;
  background: $cr7-card;
  font-size: 26rpx;
  color: $text-light;

  &.active {
    background: rgba(216, 252, 15, 0.2);
    color: $cr7-gold;
    border: 2rpx solid $cr7-gold;
  }
}
</style>
