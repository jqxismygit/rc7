<template>
  <view class="cr7-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="nav-inner">
      <view class="nav-side">
        <view v-if="showBack" class="nav-back" @click="handleBack">
          <text class="nav-back-icon">‹</text>
        </view>
      </view>
      <text class="nav-title">{{ title }}</text>
      <view class="nav-side" />
    </view>
  </view>
</template>

<script>
export default {
  name: "Cr7NavBar",
  props: {
    title: {
      type: String,
      required: true,
    },
    showBack: {
      type: Boolean,
      default: true,
    },
    /** 无页面栈时的回退地址 */
    fallbackUrl: {
      type: String,
      default: "/pages/index/index",
    },
    /** 无页面栈时：switchTab | reLaunch */
    fallbackNavigateType: {
      type: String,
      default: "switchTab",
    },
    /** 为 false 时仅触发 back 事件，由页面自行处理路由 */
    autoNavigate: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["back"],
  data() {
    return {
      statusBarHeight: 0,
    };
  },
  mounted() {
    const sys = uni.getSystemInfoSync();
    this.statusBarHeight = sys.statusBarHeight || 0;
  },
  methods: {
    handleBack() {
      this.$emit("back");
      if (!this.autoNavigate) return;
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      if (this.fallbackNavigateType === "reLaunch") {
        uni.reLaunch({ url: this.fallbackUrl });
      } else {
        uni.switchTab({ url: this.fallbackUrl });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.cr7-nav-bar {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 20;
  padding-left: $spacing-lg;
  padding-right: $spacing-lg;
  background: $cr7-black;
}

.nav-inner {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-side {
  width: 70rpx;
  height: 70rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
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

.nav-title {
  flex: 1;
  min-width: 0;
  padding: 0 16rpx;
  color: $text-white;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

</style>
