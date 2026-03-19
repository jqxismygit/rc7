<template>
  <view class="home-page">
    <scroll-view class="home-scroll" scroll-y enhanced :show-scrollbar="false">
      <!-- 顶部导航栏 - 仅通知 + CR7 LIFE logo -->
      <view class="home-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="navbar-row">
          <view class="navbar-left">
            <view class="navbar-notification" @click="goToMessages">
              <image src="/static/icons/notification.svg" class="nav-icon" mode="aspectFit" />
              <view v-if="unreadCount > 0" class="notification-dot"></view>
            </view>
          </view>
          <view class="navbar-logo">
            <image src="/static/icons/logo.svg" class="logo-img" mode="aspectFit" />
          </view>
          <view class="navbar-placeholder"></view>
        </view>
      </view>

      <!-- Hero 轮播 -->
      <view class="hero-section">
        <swiper class="hero-swiper" circular autoplay :interval="4000" :duration="500" @change="onSwiperChange">
          <swiper-item v-for="(item, index) in heroBanners" :key="index">
            <view class="hero-slide">
              <image :src="item.cover || '/static/images/event-card.jpg'" class="hero-image" mode="aspectFill" />
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

      <!-- 马上购票 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">马上购票</text>
        </view>
        <view class="event-card" @click="openTicketEvent">
          <view class="event-image-wrap">
            <image :src="ticketEvent.cover || '/static/images/event-card.jpg'" class="event-image" mode="aspectFill" />
          </view>
          <view class="event-info-bottom">
            <view class="event-info-left">
              <text class="event-title">{{ ticketEvent.title }}</text>
              <text class="event-meta">{{ ticketEvent.time }}</text>
            </view>
          </view>
        </view>
        <view class="ticket-list">
          <view
            v-for="ticket in ticketTypes"
            :key="ticket.id"
            class="ticket-card"
            @click="selectTicket(ticket)"
          >
            <view v-if="ticket.tag" class="ticket-tag-badge">
              <text class="ticket-tag-text">{{ ticket.tag }}</text>
            </view>
            <view class="ticket-card-inner">
              <view class="ticket-left">
                <text class="ticket-name">{{ ticket.name }}</text>
                <text class="ticket-desc">{{ ticket.description }}</text>
              </view>
              <view class="ticket-right">
                <text v-if="ticket.originalPrice > ticket.price" class="ticket-price-origin">￥{{ ticket.originalPrice }}</text>
                <text class="ticket-price-now" :class="{ 'price-gold': ticket.originalPrice > ticket.price }">¥{{ ticket.price }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- CR7 News -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">CR7 News</text>
        </view>
        <view class="news-list">
          <view
            v-for="item in cr7News"
            :key="item.id"
            class="news-card"
            @click="openNewsItem(item)"
          >
            <view class="news-thumb">
              <image :src="item.cover || '/static/images/event-card.jpg'" class="news-thumb-img" mode="aspectFill" />
            </view>
            <view class="news-content">
              <text class="news-title">{{ item.title }}</text>
              <text class="news-desc">{{ item.desc }}</text>
            </view>
            <image src="/static/icons/arrow-right.svg" class="news-arrow" mode="aspectFit" />
          </view>
        </view>
      </view>

      <!-- 合作伙伴 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">合作伙伴</text>
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
              <image :src="brand.logo || '/static/images/event-card.jpg'" class="brand-logo-img" mode="aspectFit" />
            </view>
            <text class="brand-name">{{ brand.name }}</text>
            <text class="brand-tagline">{{ brand.tagline }}</text>
          </view>
        </view>
      </view>

      <!-- 底部占位 -->
      <view class="bottom-spacer"></view>
    </scroll-view>
  </view>
</template>

<script>
import { useUserStore } from '@/stores/user'
import { fetchUnreadCount } from '@/services/messages.js'
import {
  fetchHeroBanners,
  fetchTicketEvent,
  fetchTicketTypes,
  fetchCr7News,
  fetchBrands
} from '@/services/home.js'
import createTabBarMixin from '@/mixins/tabBar.js'

export default {
  mixins: [createTabBarMixin(0)],
  data() {
    return {
      statusBarHeight: 0,
      unreadCount: 0,
      currentBannerIndex: 0,
      heroBanners: [],
      ticketEvent: {
        title: 'C罗博物馆 · 中国上海馆',
        time: '03/16·10:00-22:00·上海黄浦区外滩1号',
        cover: '/static/images/event-card.jpg'
      },
      ticketTypes: [],
      cr7News: [],
      brands: []
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
      const userStore = useUserStore()
      if (!userStore.isLoggedIn) {
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
        const [hero, event, tickets, news, brandList] = await Promise.all([
          fetchHeroBanners(),
          fetchTicketEvent(),
          fetchTicketTypes(),
          fetchCr7News(),
          fetchBrands()
        ])
        this.heroBanners = hero.length ? hero : [{ cover: '' }, { cover: '' }]
        this.ticketEvent = event
        this.ticketTypes = tickets
        this.cr7News = news
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

    goToMessages() {
      uni.navigateTo({ url: '/pages/messages/messages' })
    },

    openTicketEvent() {
      uni.navigateTo({ url: `/pages/ticket-purchase/ticket-purchase?id=${this.ticketEvent.id || 1}` })
    },

    selectTicket(ticket) {
      if (ticket.stock > 0) {
        const eventId = this.ticketEvent.id || 1
        const ticketId = ticket.id
        uni.navigateTo({ url: `/pages/ticket-purchase/ticket-purchase?eventId=${eventId}&ticketId=${ticketId}` })
      } else {
        uni.showToast({ title: '该票种已售罄', icon: 'none' })
      }
    },

    openNewsItem(item) {
      if (item.route) {
        uni.navigateTo({ url: item.route })
      } else if (item.type === 'video') {
        uni.navigateTo({ url: '/pages/schedule/schedule' })
      } else if (item.type === 'career') {
        uni.navigateTo({ url: '/pages/schedule/schedule' })
      } else {
        uni.showToast({ title: '详情页即将上线', icon: 'none' })
      }
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
  height: 114rpx;
  padding: 0 35rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.navbar-left {
  display: flex;
  align-items: center;
}

.navbar-placeholder {
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
  align-items: center;
  justify-content: center;
}

.logo-img {
  width: 156rpx;
  height: 35rpx;
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

/* 活动卡片 - 设计稿：上半图片 350rpx，下半信息区 $cr7-dark，总高 492rpx */
.event-card {
  width: 100%;
  height: 492rpx;
  max-width: 680rpx;
  display: flex;
  flex-direction: column;
  border-radius: 24rpx;
  overflow: hidden;
  margin-bottom: 35rpx;
}

.event-image-wrap {
  width: 100%;
  height: 350rpx;
  flex-shrink: 0;
  overflow: hidden;
}

.event-image {
  width: 100%;
  height: 100%;
}

.event-info-bottom {
  flex: 1;
  min-height: 0;
  padding: 20rpx 22rpx;
  background: $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.event-info-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.event-title {
  display: block;
  font-size: 32rpx;
  font-weight: 500;
  color: $text-white;
  line-height: 47rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-meta {
  display: block;
  font-size: 24rpx;
  font-weight: 400;
  color: $text-disabled;
  line-height: 38rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 票种列表 - 设计稿 Label - Ticket Type */
.ticket-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.ticket-card {
  position: relative;
  background: $cr7-dark;
  border-radius: 24rpx;
  padding: 30rpx;
  overflow: visible;
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
  color: #0f2316;
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
  gap: 8rpx;
}

.ticket-price-origin {
  font-size: 28rpx;
  color: $text-disabled;
  text-decoration: line-through;
}

.ticket-price-now {
  font-size: 30rpx;
  color: $text-white;
  font-weight: 700;
  line-height: 46rpx;

  &.price-gold {
    color: $cr7-gold;
  }
}

/* CR7 News - 设计稿 Hotel Nearby 列表 */
.news-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.news-card {
  display: flex;
  align-items: center;
  height: 170rpx;
  background: $cr7-dark;
  border-radius: 28rpx;
  padding: 14rpx;
  box-sizing: border-box;
}

.news-thumb {
  width: 189rpx;
  height: 142rpx;
  border-radius: 17rpx;
  overflow: hidden;
  flex-shrink: 0;
  margin-right: 21rpx;
  border: 2rpx solid $cr7-border;
}

.news-thumb-img {
  width: 100%;
  height: 100%;
}

.news-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7rpx;
}

.news-title {
  font-size: 29rpx;
  font-weight: 500;
  color: $text-white;
  line-height: 42rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.news-desc {
  font-size: 24rpx;
  color: $text-disabled;
  line-height: 38rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.news-arrow {
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
}

/* 合作伙伴 - 设计稿 327.4×300.4 卡片 */
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
</style>
