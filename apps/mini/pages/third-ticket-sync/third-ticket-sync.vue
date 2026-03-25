<template>
  <view class="sync-page">
    <cr7-nav-bar
      title="三方票同步"
      fallback-url="/pages/my-tickets/my-tickets"
    />

    <scroll-view
      class="page-scroll"
      scroll-y
      :style="{ paddingTop: navInsetPx + 'px' }"
    >
      <view class="main">
        <view class="hero">
          <view class="hero-icon-wrap">
            <sx-svg name="ticket" :width="56" :height="56" color="#D8FC0F" />
          </view>
          <text class="hero-title">输入兑换码</text>
          <text class="hero-desc"
            >输入兑换码，将第三方购票转入CR7@LIFE票夹</text
          >
        </view>

        <view class="input-card">
          <text class="input-label">兑换码</text>
          <input
            v-model.trim="code"
            class="code-input"
            placeholder="输入兑换码"
            placeholder-style="color:#787878"
            maxlength="32"
          />
          <button class="submit-btn" :disabled="!code" @click="handleSubmit">
            立即兑换
          </button>
        </view>

        <view class="tips">
          <view class="tips-title-row">
            <sx-svg name="info" :width="24" :height="24" color="#ADADAD" />
            <text class="tips-title">温馨提示</text>
          </view>
          <view class="tips-card">
            <text class="tips-item">
              1.
              支持在合作平台/线下渠道购买的票券，通过兑换码同步到当前微信账号；
            </text>
            <text class="tips-item">2. 每个兑换码仅限使用一次；</text>
            <text class="tips-item">
              3. 兑换成功后，票务信息将自动同步至“我的票价”
            </text>
          </view>
        </view>

        <view class="safe-bottom safe-area-bottom"></view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";

export default {
  components: {
    Cr7NavBar,
  },

  data() {
    return {
      code: "",
      navInsetPx: 0,
    };
  },

  onLoad() {
    this.navInsetPx = getNavBarInsetPx();
  },

  methods: {
    handleSubmit() {
      if (!this.code) {
        uni.showToast({ title: "请输入兑换码", icon: "none" });
        return;
      }
      uni.showToast({ title: "暂未支持", icon: "none" });
    },
  },
};
</script>

<style lang="scss" scoped>
.sync-page {
  height: 100vh;
  background: $cr7-black;
}

.nav-bar {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 20;
  background: $cr7-black;
}

.nav-inner {
  height: 88rpx;
  padding: 0 35rpx;
  display: flex;
  align-items: center;
}

.nav-back {
  width: 70rpx;
  height: 70rpx;
  border-radius: 40rpx;
  background: $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-back-icon {
  color: $text-white;
  font-size: 44rpx;
  line-height: 1;
  margin-top: -6rpx;
}

.nav-placeholder {
  width: 70rpx;
  height: 70rpx;
}

.page-scroll {
  height: 100vh;
  box-sizing: border-box;
}

.main {
  padding: 0 30rpx 0;
}

.hero {
  padding-top: 62rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-icon-wrap {
  width: 160rpx;
  height: 160rpx;
  border-radius: 19228rpx;
  background: rgba(216, 251, 14, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-title {
  margin-top: 40rpx;
  font-size: 40rpx;
  line-height: 69rpx;
  color: #f1f5f9;
  font-weight: 500;
}

.hero-desc {
  margin-top: 24rpx;
  font-size: 27rpx;
  line-height: 38rpx;
  color: $text-light;
  text-align: center;
}

.input-card {
  margin-top: 62rpx;
  background: $cr7-dark;
  border-radius: 32rpx;
  padding: 46rpx;
  box-shadow: 0 48rpx 96rpx -23rpx rgba(0, 0, 0, 0.25);
}

.input-label {
  font-size: 23rpx;
  line-height: 31rpx;
  color: #787878;
  letter-spacing: 2rpx;
}

.code-input {
  margin-top: 16rpx;
  height: 98rpx;
  border-radius: 16rpx;
  border: 1.75rpx solid #787878;
  background: $cr7-dark;
  color: $text-white;
  font-size: 30rpx;
  padding: 0 35rpx;
  box-sizing: border-box;
}

.submit-btn {
  margin-top: 46rpx;
  width: 100%;
  height: 97rpx;
  border-radius: 62rpx;
  background: $cr7-gold;
  color: $cr7-black;
  font-size: 31rpx;
  line-height: 97rpx;
  font-weight: 500;
  border: none;
}

.submit-btn::after {
  border: none;
}

.submit-btn[disabled] {
  opacity: 0.5;
}

.tips {
  margin-top: 46rpx;
}

.tips-title-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.tips-title {
  font-size: 31rpx;
  line-height: 46rpx;
  color: $text-white;
  font-weight: 500;
}

.tips-card {
  margin-top: 23rpx;
  background: $cr7-dark;
  border-radius: 32rpx;
  padding: 31rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.tips-item {
  font-size: 24rpx;
  line-height: 44rpx;
  color: $text-light;
}

.safe-bottom {
  height: 80rpx;
}
</style>
