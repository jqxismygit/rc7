<template>
  <view class="legal-page">
    <scroll-view scroll-y class="legal-scroll">
      <view class="legal-header">
        <text class="legal-badge">CR7® LIFE</text>
        <text class="legal-title">隐私政策</text>
        <text class="legal-subtitle">内容由 CMS 后台配置并下发</text>
      </view>

      <view class="legal-section">
        <rich-text :nodes="content" class="legal-rich-text"></rich-text>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
import { fetchLegalContent } from '@/services/legal.js'

export default {
  name: 'LegalPrivacy',
  data() {
    return {
      content: ''
    }
  },
  async onLoad() {
    this.content = await fetchLegalContent('privacy')
  }
}
</script>

<style lang="scss" scoped>
.legal-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.legal-scroll {
  height: 100vh;
}

.legal-header {
  padding: 64rpx 48rpx 32rpx;
}

.legal-badge {
  font-size: $font-xs;
  color: $cr7-gold-light;
  letter-spacing: 4rpx;
}

.legal-title {
  margin-top: 16rpx;
  font-size: $font-xxl;
  font-weight: 600;
  color: $text-white;
}

.legal-subtitle {
  margin-top: 12rpx;
  font-size: $font-sm;
  color: $text-muted;
}

.legal-section {
  padding: 32rpx 48rpx 0;
}

.legal-rich-text {
  font-size: $font-sm;
  color: $text-light;
  line-height: 1.8;
}

.safe-bottom {
  height: 80rpx;
}
</style>
