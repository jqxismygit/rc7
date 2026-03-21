<template>
  <view class="scan-page">
    <!-- 设计稿 Body 背景 750×1700，1px=1rpx -->
    <image
      class="page-bg"
      src="/static/images/scan-ticket-bg.jpg"
      mode="aspectFill"
    />

    <!-- 自定义导航 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-back" @click="goBack">
          <text class="nav-back-icon">‹</text>
        </view>
        <text class="nav-title">扫码核销</text>
        <view class="nav-placeholder"></view>
      </view>
    </view>

    <view class="main" :style="{ paddingTop: navBlockPx + 'px' }">
      <!-- 核销成功横幅（Figma：w ~680 / radius 28 / pad 21，左右 51） -->
      <view v-if="showSuccessBanner" class="success-banner">
        <view class="success-row">
          <view class="success-icon-wrap">
            <view class="success-icon-bg"></view>
            <view class="success-tick">
              <text class="success-tick-char">✓</text>
            </view>
          </view>
          <text class="success-text">核销成功，电子票已使用</text>
        </view>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <view v-if="useInlineCamera" class="camera-box">
        <camera
          class="camera"
          device-position="back"
          :flash="torchFlash"
          mode="scanCode"
          @scancode="onScanCode"
          @error="onCameraError"
        />
        <view class="scan-dim" aria-hidden="true">
          <view class="scan-hole-anchor">
            <view class="scan-hole-shadow"></view>
          </view>
        </view>
        <view class="scan-frame" aria-hidden="true">
          <view class="scan-frame-inner">
            <view class="corner corner-tl"></view>
            <view class="corner corner-tr"></view>
            <view class="corner corner-bl"></view>
            <view class="corner corner-br"></view>
            <view class="scan-line"></view>
          </view>
        </view>
      </view>
      <!-- #endif -->

      <!-- #ifndef MP-WEIXIN -->
      <view class="fallback-scan">
        <text class="fallback-tip">当前端不支持相机扫码，请使用下方按钮</text>
        <button class="fallback-btn" @click="openSystemScan">打开扫码</button>
      </view>
      <!-- #endif -->

      <!-- #ifdef MP-WEIXIN -->
      <view v-if="!useInlineCamera" class="fallback-scan">
        <text class="fallback-tip">无法使用相机时，可改用系统扫码</text>
        <button class="fallback-btn" @click="openSystemScan">打开扫码</button>
      </view>
      <!-- #endif -->

      <text class="status-primary">{{
        useInlineCamera ? "正在扫描..." : "点击按钮开始扫码"
      }}</text>
      <text class="status-sub">请将二维码/条形码置于框内</text>

      <!-- #ifdef MP-WEIXIN -->
      <view v-if="useInlineCamera" class="torch-wrap" @click="toggleTorch">
        <view class="torch-btn">
          <view class="torch-glyph"></view>
        </view>
        <text class="torch-label">轻点照亮</text>
      </view>
      <!-- #endif -->
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      statusBarHeight: 0,
      navInnerPx: 44,
      showSuccessBanner: false,
      torchOn: false,
      useInlineCamera: true,
      scanLocked: false,
      bannerTimer: null,
    };
  },

  computed: {
    navBlockPx() {
      return (this.statusBarHeight || 0) + this.navInnerPx;
    },
    torchFlash() {
      return this.torchOn ? "torch" : "off";
    },
  },

  onUnload() {
    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
  },

  onLoad() {
    const sys = uni.getSystemInfoSync();
    this.statusBarHeight = sys.statusBarHeight || 0;
    const winW = sys.windowWidth || 375;
    this.navInnerPx = (88 * winW) / 750;
    // #ifndef MP-WEIXIN
    this.useInlineCamera = false;
    // #endif
  },

  methods: {
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
      } else {
        uni.switchTab({ url: "/pages/index/index" });
      }
    },

    onCameraError() {
      this.useInlineCamera = false;
    },

    toggleTorch() {
      this.torchOn = !this.torchOn;
    },

    openSystemScan() {
      uni.scanCode({
        onlyFromCamera: true,
        scanType: ["qrCode", "barCode"],
        success: (res) => {
          this.handleScanResult(res.result || "");
        },
        fail: () => {
          uni.showToast({ title: "已取消扫码", icon: "none" });
        },
      });
    },

    onScanCode(e) {
      if (this.scanLocked) return;
      const detail = e.detail || {};
      const code = detail.result || "";
      if (!code) return;
      this.handleScanResult(code);
    },

    handleScanResult(code) {
      if (this.scanLocked || !code) return;
      this.scanLocked = true;
      uni.showLoading({ title: "核销中..." });

      setTimeout(() => {
        uni.hideLoading();
        this.showSuccessBanner = true;
        if (this.bannerTimer) clearTimeout(this.bannerTimer);
        this.bannerTimer = setTimeout(() => {
          this.showSuccessBanner = false;
          this.scanLocked = false;
          this.bannerTimer = null;
        }, 4000);
      }, 600);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.scan-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: $cr7-black;
}

.page-bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 750rpx;
  height: 1700rpx;
  max-width: 100%;
  min-height: 100%;
  z-index: 0;
  pointer-events: none;
  opacity: 0.35;
}

.nav-bar {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 30;
  background: transparent;
}

.nav-inner {
  height: 88rpx;
  padding: 0 35rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-back {
  width: 70rpx;
  height: 70rpx;
  border-radius: 50%;
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
  text-align: center;
  font-size: 36rpx;
  font-weight: 600;
  color: $text-white;
}

.nav-placeholder {
  width: 70rpx;
  height: 70rpx;
}

.success-banner {
  width: 648rpx;
  margin: 0 auto 24rpx;
  box-sizing: border-box;
  background: $cr7-dark;
  border-radius: 28rpx;
  padding: 21rpx;
  flex-shrink: 0;
}

.success-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 14rpx;
}

.success-icon-wrap {
  position: relative;
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
}

.success-icon-bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 42rpx;
  height: 42rpx;
  border-radius: 50%;
  background: rgba(4, 177, 85, 0.25);
}

.success-tick {
  position: absolute;
  left: 11rpx;
  top: 11rpx;
  width: 21rpx;
  height: 21rpx;
  border-radius: 4rpx;
  background: $cr7-success;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-tick-char {
  font-size: 14rpx;
  color: #fff;
  line-height: 1;
  font-weight: 700;
}

.success-text {
  flex: 1;
  font-size: 30rpx;
  line-height: 42rpx;
  color: $text-white;
  font-weight: 400;
}

.main {
  position: relative;
  z-index: 5;
  width: 100%;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 48rpx;
}

.camera-box {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 400rpx;
  margin-top: 24rpx;
}

.camera {
  width: 100%;
  height: 100%;
}

.scan-dim {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 2;
}

.scan-hole-anchor {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scan-hole-shadow {
  width: 504rpx;
  height: 504rpx;
  box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.72);
}

.scan-frame {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scan-frame-inner {
  position: relative;
  width: 504rpx;
  height: 504rpx;
}

.corner {
  position: absolute;
  width: 48rpx;
  height: 48rpx;
  border-color: $cr7-gold;
  border-style: solid;
  border-width: 6rpx;
}

.corner-tl {
  left: 0;
  top: 0;
  border-right: none;
  border-bottom: none;
  border-top-left-radius: 8rpx;
}

.corner-tr {
  right: 0;
  top: 0;
  border-left: none;
  border-bottom: none;
  border-top-right-radius: 8rpx;
}

.corner-bl {
  left: 0;
  bottom: 0;
  border-right: none;
  border-top: none;
  border-bottom-left-radius: 8rpx;
}

.corner-br {
  right: 0;
  bottom: 0;
  border-left: none;
  border-top: none;
  border-bottom-right-radius: 8rpx;
}

.scan-line {
  position: absolute;
  left: 32rpx;
  right: 32rpx;
  top: 50%;
  height: 4rpx;
  margin-top: -2rpx;
  background: linear-gradient(
    90deg,
    transparent,
    $cr7-gold-light,
    $cr7-gold,
    $cr7-gold-light,
    transparent
  );
  animation: scan-move 2.2s ease-in-out infinite;
}

@keyframes scan-move {
  0%,
  100% {
    transform: translateY(-200rpx);
    opacity: 0.85;
  }
  50% {
    transform: translateY(200rpx);
    opacity: 1;
  }
}

.status-primary {
  margin-top: 32rpx;
  font-size: 30rpx;
  line-height: 42rpx;
  color: $cr7-gold;
  font-weight: 500;
}

.status-sub {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 38rpx;
  color: $text-muted;
  text-align: center;
  padding: 0 48rpx;
}

.torch-wrap {
  margin-top: auto;
  padding-top: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.torch-btn {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: center;
}

.torch-glyph {
  width: 28rpx;
  height: 40rpx;
  border-radius: 6rpx 6rpx 14rpx 14rpx;
  background: linear-gradient(
    180deg,
    #ffffff 0%,
    #ffffff 55%,
    rgba(255, 255, 255, 0.35) 100%
  );
  position: relative;
}

.torch-glyph::after {
  content: "";
  position: absolute;
  left: 50%;
  top: -14rpx;
  width: 20rpx;
  height: 12rpx;
  margin-left: -10rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10rpx 10rpx 4rpx 4rpx;
}

.torch-label {
  font-size: 26rpx;
  color: $text-light;
}

.fallback-scan {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  box-sizing: border-box;
}

.fallback-tip {
  font-size: 28rpx;
  color: $text-muted;
  text-align: center;
  margin-bottom: 32rpx;
}

.fallback-btn {
  width: 400rpx;
  height: 88rpx;
  line-height: 88rpx;
  background: $cr7-gold;
  color: #0f2316;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 44rpx;
  border: none;
}

.fallback-btn::after {
  border: none;
}
</style>
