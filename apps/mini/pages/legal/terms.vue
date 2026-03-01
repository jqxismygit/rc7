<template>
  <view class="legal-page">
    <scroll-view scroll-y class="legal-scroll">
      <view class="legal-header">
        <text class="legal-badge">CR7® LIFE</text>
        <text class="legal-title">用户协议</text>
        <text class="legal-subtitle">C罗博物馆 CR7® LIFE 用户使用条款（示意文案占位）</text>
      </view>

      <view class="legal-section">
        <text class="section-title">一、总则</text>
        <text class="section-text">
          为保障您的合法权益，请在使用本小程序前，仔细阅读并充分理解本用户协议的全部内容。
          当您点击「一键登录 / 注册」并完成登录，即视为您已阅读并同意本协议全部条款。
        </text>
      </view>

      <view class="legal-section">
        <text class="section-title">二、服务内容</text>
        <text class="section-text">
          本小程序向您提供包括但不限于：展览及活动信息浏览、在线购票、票券管理、线下活动报名、
          互动游戏、联名品牌展示等功能，具体以实际上线功能为准。
        </text>
      </view>

      <view class="legal-section">
        <text class="section-title">三、用户行为规范</text>
        <text class="section-text">
          您在使用本小程序过程中应遵守相关法律法规，不得利用本服务从事任何违法违规或侵害他人合法权益的行为。
          如因您的行为给第三方或平台造成损失，您应承担全部责任。
        </text>
      </view>

      <view class="legal-section">
        <text class="section-title">四、协议的变更与终止</text>
        <text class="section-text">
          根据运营需要，我们可能适时对本协议进行更新。更新后的协议将通过适当方式向您展示，
          如您继续使用本服务，即视为接受更新后的协议条款。
        </text>
      </view>

      <view class="legal-section">
        <text class="section-title">五、联系方式</text>
        <text class="section-text">
          如您对本协议或本服务有任何疑问、意见或建议，可通过小程序中的「联系客服」与我们取得联系。
        </text>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
export default {
  name: 'LegalTerms'
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

.section-title {
  display: block;
  font-size: $font-lg;
  color: $cr7-gold;
  margin-bottom: 16rpx;
}

.section-text {
  display: block;
  font-size: $font-sm;
  color: $text-light;
  line-height: 1.8;
}

.safe-bottom {
  height: 80rpx;
}
</style>
