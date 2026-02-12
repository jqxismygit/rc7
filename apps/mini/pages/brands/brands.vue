<template>
  <view class="container">
    <scroll-view class="content" scroll-y>
      <view class="header">
        <text class="title">联名品牌</text>
        <text class="subtitle">C罗官方合作伙伴</text>
      </view>

      <view class="brand-grid">
        <view 
          v-for="brand in brands" 
          :key="brand.id"
          class="brand-card"
          @click="handleBrandClick(brand)"
        >
          <image :src="brand.logo" mode="aspectFit" class="brand-logo"></image>
          <text class="brand-name">{{ brand.name }}</text>
          <text class="brand-desc">{{ brand.description }}</text>
          <view class="products">
            <text v-for="product in brand.products" :key="product" class="product-tag">
              {{ product }}
            </text>
          </view>
          <view class="visit-btn">访问商城 ›</view>
        </view>
      </view>
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
          content: `即将跳转至${brand.name}小程序商城`,
          success: (res) => {
            if (res.confirm) {
              // 实际项目中使用 uni.navigateToMiniProgram
              uni.showToast({
                title: '小程序跳转功能需在真机环境测试',
                icon: 'none',
                duration: 2000
              })
            }
          }
        })
      } else {
        uni.showToast({
          title: '该品牌暂未开通商城',
          icon: 'none'
        })
      }
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.content {
  padding: 30rpx;
}

.header {
  text-align: center;
  padding: 40rpx 0;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 26rpx;
  color: #999;
}

.brand-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.brand-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand-logo {
  width: 120rpx;
  height: 120rpx;
  margin-bottom: 20rpx;
}

.brand-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.brand-desc {
  font-size: 22rpx;
  color: #999;
  text-align: center;
  margin-bottom: 20rpx;
  line-height: 1.5;
}

.products {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  justify-content: center;
  margin-bottom: 20rpx;
}

.product-tag {
  padding: 6rpx 16rpx;
  background: #f0f0f0;
  color: #666;
  font-size: 20rpx;
  border-radius: 20rpx;
}

.visit-btn {
  width: 100%;
  text-align: center;
  padding: 16rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 40rpx;
  font-size: 24rpx;
}
</style>
