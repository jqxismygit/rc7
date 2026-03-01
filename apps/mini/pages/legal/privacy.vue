<template>
  <view class="legal-page">
    <scroll-view scroll-y class="legal-scroll">
      <view class="legal-header">
        <text class="legal-badge">CR7® LIFE</text>
        <text class="legal-title">隐私政策</text>
        <text class="legal-subtitle">C罗博物馆 CR7® LIFE 隐私保护说明（示意文案占位）</text>
      </view>

      <view class="legal-section">
        <text class="section-title">一、信息收集</text>
        <text class="section-text">
          在您使用本小程序的过程中，我们将依据最小必要原则收集与提供服务相关的个人信息，
          例如微信头像昵称、设备信息、订单信息等，用于身份识别、购票下单、订单查询及安全风控。
        </text>
      </view>

      <view class="legal-section">
        <text class="section-title">二、信息使用</text>
        <text class="section-text">
          我们仅会在实现本政策所述目的所必需的范围内使用您的个人信息，
          包括但不限于完成购票、核销、订单售后、活动通知、风险控制与防止欺诈等。
        </text>
      </view>

      <view class="legal-section">
        <text class="section-title">三、信息共享与对外提供</text>
        <text class="section-text">
          非经您同意，我们不会向任何第三方出售或出租您的个人信息。
          如基于履行订单、法律法规或监管要求确需对外提供时，我们将按照合法、正当、必要的原则进行最小范围共享。
        </text>
      </view>

      <view class="legal-section">
        <text class="section-title">四、您的权利</text>
        <text class="section-text">
          您有权访问、更正、删除您的部分个人信息，并可撤回授权同意或注销账号。
          具体路径可在「我的」-「隐私政策」中查看正式版本的说明。
        </text>
      </view>

      <view class="legal-section">
        <text class="section-title">五、联系方式</text>
        <text class="section-text">
          如您对本隐私政策有任何疑问或投诉意见，可通过小程序内的「联系客服」与我们取得联系，
          我们将尽快为您处理。
        </text>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
export default {
  name: 'LegalPrivacy'
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
