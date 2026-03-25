<template>
  <view class="legal-center-page">
    <cr7-nav-bar
      title="隐私政策/服务协议"
      fallback-url="/pages/profile/profile"
    />

    <scroll-view
      class="legal-scroll"
      scroll-y
      :style="{ paddingTop: navInsetPx + 'px' }"
      :scroll-with-animation="true"
    >
      <view class="tabs-header">
        <view
          class="tab-item"
          :class="{ active: activeType === 'privacy' }"
          @click="setActive('privacy')"
        >
          隐私政策
        </view>
        <view
          class="tab-item"
          :class="{ active: activeType === 'terms' }"
          @click="setActive('terms')"
        >
          服务协议
        </view>
      </view>

      <view class="legal-section">
        <rich-text :nodes="content" class="legal-rich-text"></rich-text>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { fetchLegalContent } from "@/services/legal.js";

export default {
  components: {
    Cr7NavBar,
  },

  data() {
    return {
      navInsetPx: 0,
      activeType: "privacy",
      content: "",
    };
  },

  async onLoad(options) {
    this.navInsetPx = getNavBarInsetPx();
    const rawType = options?.type || options?.tab;
    if (rawType === "terms" || rawType === "privacy") {
      this.activeType = rawType;
    }
    await this.loadContent();
  },

  methods: {
    async setActive(type) {
      if (this.activeType === type) return;
      this.activeType = type;
      await this.loadContent();
    },

    async loadContent() {
      try {
        this.content = await fetchLegalContent(this.activeType);
      } catch (e) {
        // mock 服务失败兜底：避免页面空白且不报错影响用户
        this.content = "";
        uni.showToast({ title: "内容加载失败", icon: "none" });
        console.error("loadLegalContent", e);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.legal-center-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.legal-scroll {
  height: 100vh;
  box-sizing: border-box;
}

.tabs-header {
  // 参考设计稿：顶部暗色磨砂背景 + 底部弱边框
  margin: 0 0 0;
  padding: 0 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 10, 7, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 2rpx solid rgba(216, 251, 14, 0.1);
}

.tab-item {
  flex: 1;
  text-align: center;
  font-size: 27rpx;
  font-weight: 500;
  color: $text-light;
  padding: 15rpx 0 26rpx;
  border-bottom: 4rpx solid transparent;
}

.tab-item.active {
  color: $cr7-gold;
  border-bottom-color: $cr7-gold;
}

.legal-section {
  padding: 32rpx 30rpx 0;
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
