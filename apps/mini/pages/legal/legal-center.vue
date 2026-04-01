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
        <view v-if="loading" class="state-wrap">
          <text class="state-text">加载中…</text>
        </view>
        <view v-else-if="errorText" class="state-wrap">
          <text class="state-text">{{ errorText }}</text>
        </view>
        <rich-text
          v-else
          :nodes="content || '<p></p>'"
          class="legal-rich-text"
        ></rich-text>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { fetchArticleById } from "@/services/article.js";
const TERMS_KEY = "2acc6397-887e-4a4d-823d-10d692c10ed7"; //服务协议
const PRIVACY_KEY = "c5062640-e595-48c2-8d5f-40f6e4150e3e"; //隐私政策
export default {
  components: {
    Cr7NavBar,
  },

  data() {
    return {
      navInsetPx: 0,
      activeType: "privacy",
      content: "",
      loading: false,
      errorText: "",
      contentCache: {
        privacy: "",
        terms: "",
      },
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
      if (this.contentCache[this.activeType]) {
        this.content = this.contentCache[this.activeType];
        this.errorText = "";
        this.loading = false;
        return;
      }
      const articleId =
        this.activeType === "terms" ? TERMS_KEY : PRIVACY_KEY;
      if (!articleId) {
        this.content = "";
        this.errorText = "缺少文章 ID";
        return;
      }
      this.loading = true;
      this.errorText = "";
      try {
        const article = await fetchArticleById(articleId);
        const html = article?.content || "";
        this.content = html;
        this.contentCache[this.activeType] = html;
      } catch (e) {
        this.content = "";
        const msg =
          e?.data?.message ||
          e?.errMsg ||
          (typeof e?.message === "string" ? e.message : "") ||
          "内容加载失败";
        this.errorText = msg;
        uni.showToast({ title: "内容加载失败", icon: "none" });
        console.error("loadLegalContent", e);
      } finally {
        this.loading = false;
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

.state-wrap {
  padding: 80rpx 0;
  display: flex;
  justify-content: center;
}

.state-text {
  font-size: $font-sm;
  color: $text-light;
}

.safe-bottom {
  height: 80rpx;
}
</style>
