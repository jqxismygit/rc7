<template>
  <view class="scan-page">
    <!-- 自定义导航 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-back" @click="goBack">
          <text class="nav-back-icon">‹</text>
        </view>
        <text class="nav-title">票码兑换</text>
        <view class="nav-placeholder"></view>
      </view>
    </view>

    <!-- 核销结果横幅：悬浮 overlay，不影响主体布局 -->
    <view
      v-if="showStatusBanner"
      class="success-banner success-banner-float"
      :style="{ top: navBlockPx + 24 + 'px' }"
    >
      <view class="success-row">
        <sx-svg
          :name="statusBannerIcon"
          :width="42"
          :height="42"
          color="#FFFFFF"
        />
        <text class="success-text">{{ statusBannerText }}</text>
      </view>
    </view>

    <view class="main" :style="{ paddingTop: navBlockPx + 'px' }">
      <view v-if="useInlineCamera" class="camera-box">
        <camera
          class="camera"
          device-position="back"
          :flash="torchFlash"
          mode="scanCode"
          @scancode="onScanCode"
          @error="onCameraError"
        />
        <!-- <view class="scan-dim" aria-hidden="true">
          <view class="scan-hole-anchor">
            <view class="scan-hole-shadow"></view>
          </view>
        </view> -->
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

      <view v-if="!useInlineCamera" class="fallback-scan">
        <text class="fallback-tip">无法使用相机时，可改用系统扫码</text>
        <button class="fallback-btn" @click="openSystemScan">打开扫码</button>
      </view>

      <view class="status-wrap">
        <text class="status-primary">{{
          useInlineCamera ? "正在扫描..." : "点击按钮开始扫码"
        }}</text>
        <text class="status-sub">请将二维码/条形码置于框内</text>
      </view>

      <view v-if="useInlineCamera" class="torch-wrap" @click="toggleTorch">
        <view class="torch-btn">
          <view class="torch-glyph"></view>
        </view>
        <text class="torch-label">轻点照亮</text>
      </view>
    </view>
  </view>
</template>

<script>
import { redeemTicket } from "@/services/redeem.js";

export default {
  data() {
    return {
      statusBarHeight: 0,
      navInnerPx: 44,
      showStatusBanner: false,
      statusBannerType: "success",
      torchOn: false,
      useInlineCamera: true,
      scanLocked: false,
      bannerTimer: null,
      scanUnlockTimer: null,
    };
  },

  computed: {
    navBlockPx() {
      return (this.statusBarHeight || 0) + this.navInnerPx;
    },
    torchFlash() {
      return this.torchOn ? "torch" : "off";
    },
    statusBannerIcon() {
      return this.statusBannerType === "failed" ? "failed" : "success-fill";
    },
    statusBannerText() {
      return this.statusBannerType === "failed"
        ? "核销失败，电子票无效"
        : "核销成功，电子票已使用";
    },
  },

  onUnload() {
    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
    if (this.scanUnlockTimer) {
      clearTimeout(this.scanUnlockTimer);
      this.scanUnlockTimer = null;
    }
  },

  onLoad() {
    const sys = uni.getSystemInfoSync();
    this.statusBarHeight = sys.statusBarHeight || 0;
    const winW = sys.windowWidth || 375;
    this.navInnerPx = (88 * winW) / 750;
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

    extractRedeemCode(raw) {
      const text = String(raw || "").trim();
      if (!text) return "";
      const keyMatch = text.match(/(?:^|[?|&|])code=([^|&\s]+)/i);
      if (keyMatch?.[1]) {
        return decodeURIComponent(keyMatch[1]).trim();
      }
      const matched = text.match(/R[A-Z0-9]{11}/i);
      if (matched && matched[0]) return matched[0];
      return text;
    },

    parseRedeemPayload(raw) {
      const text = String(raw || "").trim();
      if (!text) return { eid: "", code: "" };
      const eidMatch = text.match(/(?:^|[?|&|])eid=([A-Za-z0-9-_%]+)/i);
      const eid = eidMatch?.[1] ? decodeURIComponent(eidMatch[1]) : "";
      const code = this.extractRedeemCode(text);

      return { eid, code };
    },

    pickRedeemErrorMessage(err) {
      const data = err?.data;
      if (data && typeof data === "object" && data.message) {
        return String(data.message);
      }
      const code = err?.statusCode;
      if (code === 400) return "券码格式错误，请重新扫码";
      if (code === 401) return "无核销权限，请联系管理员";
      if (code === 404) return "券码不存在或不属于当前展会";
      if (code === 409) return "该券码已核销或已过期";
      return "核销失败，请稍后重试";
    },

    showRedeemBanner(type) {
      this.statusBannerType = type === "failed" ? "failed" : "success";
      this.showStatusBanner = true;
      if (this.bannerTimer) clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => {
        this.showStatusBanner = false;
        this.bannerTimer = null;
      }, 3000);
    },

    releaseScanLock(delay = 0) {
      if (this.scanUnlockTimer) {
        clearTimeout(this.scanUnlockTimer);
        this.scanUnlockTimer = null;
      }
      if (delay <= 0) {
        this.scanLocked = false;
        return;
      }
      this.scanUnlockTimer = setTimeout(() => {
        this.scanLocked = false;
        this.scanUnlockTimer = null;
      }, delay);
    },

    async handleScanResult(code) {
      if (this.scanLocked || !code) return;
      this.scanLocked = true;
      const { eid, code: redeemCode } = this.parseRedeemPayload(code);
      if (!redeemCode) {
        this.releaseScanLock(1800);
        this.showRedeemBanner("failed");
        uni.showToast({ title: "未识别到有效券码", icon: "none" });
        return;
      }
      if (!eid) {
        this.releaseScanLock(1800);
        this.showRedeemBanner("failed");
        uni.showToast({ title: "二维码缺少展会信息，无法核销", icon: "none" });
        return;
      }
      try {
        uni.showLoading({ title: "核销中...", mask: true });
        await redeemTicket(eid, { code: redeemCode });
        uni.hideLoading();
        this.showRedeemBanner("success");
        this.releaseScanLock(800);
      } catch (e) {
        uni.hideLoading();
        this.releaseScanLock(1800);
        this.showRedeemBanner("failed");
        // uni.showToast({ title: this.pickRedeemErrorMessage(e), icon: "none" });
      }
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
  background: #090a07;
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

/* 悬浮成功横幅：不参与文档流，不影响扫码区域布局 */
.success-banner-float {
  position: fixed;
  left: 51rpx;
  right: 51rpx;
  height: 85rpx;
  z-index: 25;
  pointer-events: none;
}

.success-banner {
  box-sizing: border-box;
  background: $cr7-dark;
  border-radius: 28rpx;
  padding: 21rpx;
  flex-shrink: 0;
}

.success-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
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
  font-size: 30rpx;
  line-height: 30rpx;
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
  overflow: hidden;
}

/* camera-box 固定 504rpx，与扫码框一致，不占满整屏 */
.camera-box {
  position: relative;
  width: 554rpx;
  height: 554rpx;
  margin-top: 250rpx;
  flex-shrink: 0;
}

/* camera 与 scan-frame 完全重叠填充 camera-box */
.camera,
.scan-frame {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.camera {
  pointer-events: auto;
  z-index: 1;
}

.scan-frame {
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
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
  width: 554rpx;
  height: 554rpx;
  box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.72);
}

.scan-frame-inner {
  position: relative;
  width: 554rpx;
  height: 554rpx;
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

.status-wrap {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 61rpx;
}

.status-primary {
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
  flex-shrink: 0;
  padding-top: 114rpx;
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
