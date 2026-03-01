<template>
  <view class="login-page safe-area-top safe-area-bottom">
    <!-- 背景：C罗大图 + 渐变遮罩 -->
    <image src="/static/cr7-login-bg.jpg" class="login-bg" mode="aspectFill"></image>
    <view class="login-bg-mask"></view>

    <!-- 品牌 & 登录内容 -->
    <view class="login-content">
      <!-- CR7 圆形徽章 -->
      <view class="cr7-badge">
        <view class="badge-outer">
          <view class="badge-inner">
            <text class="badge-cr7">CR7</text>
            <text class="badge-sub">MUSEUM · LIFE</text>
          </view>
        </view>
      </view>

      <!-- 品牌标题 -->
      <view class="brand-title">
        <text class="brand-main">C罗博物馆</text>
        <text class="brand-sub">CR7® LIFE</text>
      </view>

      <!-- 登录操作区 -->
      <view class="login-actions">
        <view class="agreement-row">
          <checkbox-group @change="onAgreeChange">
            <label class="agree-label">
              <checkbox value="agree" :checked="agreed" color="#C9A84C" />
              <text class="agreement-text">
                已阅读并同意
                <text class="link" @click.stop="openLegal('terms')">《用户协议》</text>
                与
                <text class="link" @click.stop="openLegal('privacy')">《隐私政策》</text>
              </text>
            </label>
          </checkbox-group>
        </view>

        <button
          class="login-btn btn-gold"
          :disabled="!agreed || loading"
          :loading="loading"
          @click="handleWechatLogin"
        >
          <text class="btn-icon"></text>
          <text>一键登录 / 注册</text>
        </button>

        <text class="login-tip">
          为提供购票、订单管理等服务，我们将基于用户协议与隐私政策处理必要信息。
        </text>
      </view>
    </view>
  </view>
</template>

<script>
import { mockUser, mockEmployee } from '@/utils/mockData.js'
import storage from '@/utils/storage.js'

export default {
  data() {
    return {
      agreed: false,
      loading: false
    }
  },

  methods: {
    onAgreeChange(e) {
      this.agreed = (e.detail.value || []).includes('agree')
    },

    handleWechatLogin() {
      if (!this.agreed) {
        uni.showToast({
          title: '请先勾选并同意协议',
          icon: 'none'
        })
        return
      }

      this.loading = true

      // 模拟微信一键登录 / 注册
      setTimeout(() => {
        const isEmployee = Math.random() > 0.8
        const user = isEmployee ? mockEmployee : mockUser

        storage.setUserInfo(user)
        storage.setToken('mock_token_' + Date.now())
        storage.setIsEmployee(isEmployee)

        this.loading = false

        uni.showToast({
          title: '欢迎来到 CR7® LIFE',
          icon: 'success'
        })

        setTimeout(() => {
          uni.switchTab({
            url: '/pages/index/index'
          })
        }, 800)
      }, 1200)
    },

    openLegal(type) {
      const url =
        type === 'privacy'
          ? '/pages/legal/privacy'
          : '/pages/legal/terms'

      uni.navigateTo({ url })
    }
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background: $gradient-dark;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0.35;
}

.login-bg-mask {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: $gradient-hero;
}

.login-content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding: 160rpx 64rpx 120rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}

.cr7-badge {
  margin-top: 40rpx;
  margin-bottom: 48rpx;
}

.badge-outer {
  width: 260rpx;
  height: 260rpx;
  border-radius: 50%;
  padding: 8rpx;
  background: $gradient-gold;
  box-shadow: $shadow-gold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 0%, rgba(255,255,255,0.12), transparent 55%), $gradient-dark;
  border: 2rpx solid rgba(255,255,255,0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.badge-cr7 {
  font-size: $font-hero;
  font-weight: 800;
  letter-spacing: 6rpx;
  color: $text-white;
}

.badge-sub {
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-light;
  letter-spacing: 4rpx;
}

.brand-title {
  align-items: center;
  text-align: center;
  margin-bottom: 120rpx;
}

.brand-main {
  display: block;
  font-size: $font-xxl;
  color: $text-white;
  font-weight: 600;
}

.brand-sub {
  display: block;
  margin-top: 8rpx;
  font-size: $font-md;
  color: $cr7-gold-light;
  letter-spacing: 4rpx;
}

.login-actions {
  width: 100%;
}

.agreement-row {
  margin-bottom: 40rpx;
  color: $text-light;
}

.agree-label {
  display: flex;
  align-items: flex-start;
}

.agreement-text {
  font-size: $font-sm;
  color: $text-light;
  margin-left: 16rpx;
  line-height: 1.6;
}

.link {
  color: $cr7-gold-light;
}

.login-btn {
  width: 100%;
  height: 96rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-lg;
  font-weight: 700;
  letter-spacing: 4rpx;
}

.login-btn::after {
  border: none;
}

.btn-icon {
  font-family: 'iconfont';
  font-size: 40rpx;
  margin-right: 12rpx;
}

.login-tip {
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-muted;
  text-align: center;
}
</style>
