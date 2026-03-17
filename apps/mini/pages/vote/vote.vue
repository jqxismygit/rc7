<template>
  <view class="exchange-page">
    <view class="card-dark exchange-card">
      <text class="title">票码兑换</text>
      <text class="subtitle">输入兑换码，将第三方购票转入 CR7® LIFE 票夹</text>

      <input
        class="code-input"
        v-model="code"
        placeholder="请输入兑换码"
        placeholder-style="color:#555555"
        maxlength="32"
      />

      <button
        class="btn-gold submit-btn"
        :disabled="!code"
        @click="handleSubmit"
      >
        提交兑换
      </button>

      <text class="hint">
        支持在合作平台/线下渠道购买的票券，通过兑换码同步到当前微信账号。
      </text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      code: ''
    }
  },

  methods: {
    handleSubmit() {
      if (!this.code) {
        uni.showToast({
          title: '请输入兑换码',
          icon: 'none'
        })
        return
      }

      uni.showLoading({ title: '兑换中...' })

      setTimeout(() => {
        uni.hideLoading()
        uni.showToast({
          title: '兑换成功，已同步至票夹',
          icon: 'success'
        })
        setTimeout(() => {
          uni.switchTab({
            url: '/pages/my-tickets/my-tickets'
          })
        }, 1200)
      }, 1500)
    }
  }
}
</script>

<style lang="scss" scoped>
.exchange-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
  padding: 40rpx 32rpx 0;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.exchange-card {
  padding: 32rpx 28rpx 24rpx;
}

.title {
  font-size: $font-lg;
  color: $text-white;
  font-weight: 600;
}

.subtitle {
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-light;
}

.code-input {
  margin-top: 24rpx;
  padding: 20rpx 24rpx;
  border-radius: $radius-md;
  background: $cr7-dark;
  color: $text-white;
  font-size: $font-md;
}

.submit-btn {
  margin-top: 24rpx;
  width: 100%;
  height: 88rpx;
}

.submit-btn[disabled] {
  opacity: 0.5;
}

.hint {
  margin-top: 16rpx;
  font-size: $font-xs;
  color: $text-muted;
}
</style>