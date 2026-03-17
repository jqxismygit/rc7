<template>
  <view class="brands-page">
    <scroll-view class="brands-scroll" scroll-y>
      <view class="brand-grid">
        <view
          v-for="brand in brands"
          :key="brand.id"
          class="brand-card"
          @click="handleBrandClick(brand)"
        >
          <view class="brand-cover-area">
            <image
              :src="brand.logo || '/static/images/event-card.jpg'"
              class="brand-cover-img"
              mode="aspectFill"
            />
          </view>
          <text class="brand-name">{{ brand.name }}</text>
          <text class="brand-desc">{{ brand.description }}</text>
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
@import '@/uni.scss';

/* 设计稿 327.4×300.4 卡片，与首页合作伙伴区块一致 */
.brands-page {
  min-height: 100vh;
  background: $cr7-black;
}

.brands-scroll {
  padding: 24rpx 36rpx;
}

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

.brand-cover-area {
  width: 100%;
  height: 163rpx;
  background: $cr7-card;
  border-radius: 17rpx;
  overflow: hidden;
  flex-shrink: 0;
  margin-bottom: 21rpx;
}

.brand-cover-img {
  width: 100%;
  height: 100%;
}

.brand-name {
  display: block;
  font-size: 30rpx;
  font-weight: 500;
  color: $text-white;
  text-align: center;
  line-height: 42rpx;
  margin-bottom: 2rpx;
}

.brand-desc {
  display: block;
  font-size: 24rpx;
  color: $text-light;
  text-align: center;
  line-height: 38rpx;
}

.safe-bottom {
  height: 80rpx;
}
</style>
