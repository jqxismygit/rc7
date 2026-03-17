<template>
  <view class="brands-page">
    <scroll-view class="brands-scroll" scroll-y>
      <view class="header">
        <text class="title">联名品牌</text>
        <text class="subtitle">CR7® LIFE 官方合作伙伴</text>
      </view>

      <view class="brand-grid">
        <view
          v-for="brand in brands"
          :key="brand.id"
          class="brand-card card-dark"
          @click="handleBrandClick(brand)"
        >
          <view class="brand-logo-circle">
            <text class="brand-logo-text">
              {{ brand.initials || brand.name.slice(0, 2) }}
            </text>
          </view>
          <text class="brand-name">{{ brand.name }}</text>
          <text class="brand-desc">{{ brand.description }}</text>
          <view class="products">
            <text
              v-for="product in brand.products"
              :key="product"
              class="product-tag"
            >
              {{ product }}
            </text>
          </view>
          <view class="visit-row">
            <text class="visit-text">
              {{ brand.miniAppId ? '访问联名小程序' : '更多合作即将公布' }}
            </text>
            <text class="visit-arrow">›</text>
          </view>
        </view>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
import { mockBrands } from '@/utils/mockData.js'

export default {
  data() {
    return {
      brands: []
    }
  },

  onLoad() {
    this.loadBrands()
  },

  methods: {
    loadBrands() {
      this.brands = mockBrands
    },

    handleBrandClick(brand) {
      if (brand.miniAppId) {
        uni.showModal({
          title: '跳转确认',
          content: `即将跳转至「${brand.name}」品牌小程序，是否继续？`,
          success: (res) => {
            if (res.confirm) {
              uni.showToast({
                title: '小程序跳转需在真机环境测试',
                icon: 'none',
                duration: 2000
              })
            }
          }
        })
      } else {
        uni.showToast({
          title: '该品牌商城即将上线',
          icon: 'none'
        })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.brands-page {
  min-height: 100vh;
  background: $cr7-black;
}

.brands-scroll {
  padding: 24rpx;
}

.header {
  text-align: center;
  padding: 24rpx 0 16rpx;
}

.title {
  font-size: $font-xxl;
  color: $text-white;
  font-weight: 600;
}

.subtitle {
  margin-top: 6rpx;
  font-size: $font-sm;
  color: $text-muted;
}

.brand-grid {
  margin-top: 20rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.brand-card {
  padding: 20rpx 18rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand-logo-circle {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 0% 0%, rgba(216, 252, 15, 0.24), transparent 55%), $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.brand-logo-text {
  font-size: $font-lg;
  color: $cr7-gold-light;
  font-weight: 700;
}

.brand-name {
  font-size: $font-md;
  color: $text-white;
  font-weight: 600;
  margin-bottom: 4rpx;
  text-align: center;
}

.brand-desc {
  font-size: $font-xs;
  color: $text-light;
  text-align: center;
  margin-bottom: 10rpx;
}

.products {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  justify-content: center;
  margin-bottom: 10rpx;
}

.product-tag {
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: $cr7-dark;
  font-size: $font-xs;
  color: $text-light;
}

.visit-row {
  width: 100%;
  margin-top: 4rpx;
  padding-top: 8rpx;
  border-top: 1rpx solid $cr7-border;
  display: flex;
  align-items: center;
  justify-content: center;
}

.visit-text {
  font-size: $font-xs;
  color: $cr7-gold-light;
}

.visit-arrow {
  font-size: $font-xs;
  color: $cr7-gold-light;
  margin-left: 4rpx;
}

.safe-bottom {
  height: 80rpx;
}
</style>
