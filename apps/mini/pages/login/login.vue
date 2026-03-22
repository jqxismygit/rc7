<template>
  <view class="login-page">
    <view class="login-bg-wrap">
      <image
        class="login-bg"
        src="/static/images/event-card.jpg"
        mode="aspectFill"
      />
    </view>
    <view class="login-bg-mask" />

    <view class="login-body">
      <!-- 与首页 home-navbar 一致：状态栏高度 + 114rpx 行，Logo 156×35 居中 -->
      <view
        class="login-navbar"
        :style="{ paddingTop: statusBarHeight + 'px' }"
      >
        <view class="login-navbar-row">
          <view class="login-navbar-side"></view>
          <view class="login-navbar-logo">
            <sx-svg
              class="login-logo-img"
              name="logo"
              :width="156"
              :height="35"
              color="#FFFFFF"
            />
          </view>
          <view class="login-navbar-side"></view>
        </view>
      </view>

      <view class="brand-block">
        <text class="brand-serif">CR7</text>
      </view>
    </view>

    <view class="login-float-panel">
      <view class="login-float-inner safe-area-bottom">
        <view class="bottom-actions">
          <button
            class="login-btn btn-gold"
            :class="{ 'login-btn--disabled': !agreed }"
            :disabled="!agreed"
            :loading="loading"
            hover-class="none"
            @click="handleWechatLogin"
          >
            一键登录/注册
          </button>
        </view>

        <view class="agreement-block">
          <view class="agreement-radio-hit" @click.stop="toggleAgree">
            <view
              class="agreement-radio"
              :class="{ 'agreement-radio--on': agreed }"
            >
              <view v-if="agreed" class="agreement-radio-dot" />
            </view>
          </view>
          <view class="agreement-copy-wrap" @click="toggleAgree">
            <text class="agreement-copy">
              <text class="agreement-plain">已阅读并同意</text>
              <text class="agreement-link" @click.stop="openLegal('terms')"
                >《用户协议》</text
              >
              <text class="agreement-link" @click.stop="openLegal('privacy')"
                >《隐私政策》</text
              >
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { useUserStore } from "@/stores/user";
import { loginWithWechatPhone } from "@/services/auth.js";

export default {
  data() {
    return {
      statusBarHeight: 0,
      agreed: false,
      loading: false,
    };
  },

  onLoad() {
    const systemInfo = uni.getSystemInfoSync();
    this.statusBarHeight = systemInfo.statusBarHeight || 0;
  },

  methods: {
    toggleAgree() {
      this.agreed = !this.agreed;
    },

    async handleWechatLogin() {
      if (!this.agreed || this.loading) {
        return;
      }

      this.loading = true;
      const userStore = useUserStore();

      try {
        const { user, token, isEmployee } = await loginWithWechatPhone();

        userStore.setToken(token);
        userStore.setProfile(user);
        userStore.setIsEmployee(isEmployee);

        uni.showToast({
          title: "欢迎来到 CR7® LIFE",
          icon: "success",
        });

        setTimeout(() => {
          uni.switchTab({
            url: "/pages/index/index",
          });
        }, 800);
      } catch (e) {
        console.error("登录失败", e);
        uni.showToast({
          title: "登录失败，请稍后重试",
          icon: "none",
        });
      } finally {
        this.loading = false;
      }
    },

    openLegal(type) {
      const url =
        type === "privacy" ? "/pages/legal/privacy" : "/pages/legal/terms";

      uni.navigateTo({ url });
    },
  },
};
</script>

<style lang="scss" scoped>
.login-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
  overflow: hidden;
}

.login-bg-wrap {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
}

.login-bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.login-bg-mask {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    180deg,
    rgba(9, 10, 7, 0.55) 0%,
    rgba(9, 10, 7, 0.12) 38%,
    rgba(9, 10, 7, 0.2) 65%,
    rgba(9, 10, 7, 0.35) 100%
  );
  pointer-events: none;
}

.login-body {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: 320rpx;
  box-sizing: border-box;
}

/* 对齐首页 .home-navbar + .navbar-row + .navbar-logo + .logo-img */
.login-navbar {
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.login-navbar-row {
  height: 114rpx;
  padding: 0 35rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.login-navbar-side {
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
}

.login-navbar-logo {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-logo-img {
  width: 156rpx;
  height: 35rpx;
}

.brand-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 18rpx 48rpx 48rpx;
  box-sizing: border-box;
}

.brand-serif {
  margin-top: 40rpx;
  font-size: 60rpx;
  line-height: 1;
  font-weight: 400;
  color: $text-white;
  letter-spacing: 4rpx;
  font-family: Georgia, "Times New Roman", "Songti SC", serif;
}

.login-float-panel {
  position: fixed;
  left: 30rpx;
  right: 30rpx;
  bottom: 132rpx;
  z-index: 20;
  border-radius: 32rpx;
  overflow: hidden;
  // background: rgba(22, 23, 20, 0.88);
  // border: 1rpx solid rgba(255, 255, 255, 0.06);
  // box-shadow:
  //   0 24rpx 64rpx rgba(0, 0, 0, 0.45),
  //   0 0 0 1rpx rgba(0, 0, 0, 0.2);
  // backdrop-filter: blur(40rpx);
  // -webkit-backdrop-filter: blur(40rpx);
}

.login-float-inner {
  padding: 28rpx 0 20rpx;
}

.bottom-actions {
  padding: 0 0 8rpx;
}

.login-btn {
  width: 100%;
  height: 98rpx;
  border-radius: 999rpx;
  font-size: 31rpx;
  font-weight: 400;
  color: $cr7-black;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-btn::after {
  border: none;
}

/* 对齐 uni.scss .btn-disabled：未同意协议时不可点 */
.login-btn--disabled,
.login-btn[disabled] {
  background: $cr7-card !important;
  color: $text-muted !important;
  opacity: 1;
}

.agreement-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 16rpx 0 8rpx;
}

.agreement-radio-hit {
  flex-shrink: 0;
  padding: 4rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 设计稿：前置圆形 Radio，选中后内点填充方可登录 */
.agreement-radio {
  position: relative;
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 255, 255, 0.85);
  box-sizing: border-box;
  background: transparent;
}

.agreement-radio--on {
  border-color: $cr7-gold;
}

.agreement-radio-dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10rpx;
  height: 10rpx;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: $cr7-gold;
}

.agreement-copy-wrap {
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.agreement-copy {
  max-width: 560rpx;
  text-align: center;
}

.agreement-plain,
.agreement-link {
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-weight: 500;
  font-size: 24rpx;
  line-height: 46.15rpx;
  letter-spacing: 0;
  text-align: center;
  vertical-align: middle;
}

.agreement-plain {
  color: $text-white;
}

.agreement-link {
  color: $cr7-gold;
}
</style>
