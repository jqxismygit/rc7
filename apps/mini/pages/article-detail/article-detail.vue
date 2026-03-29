<template>
  <view class="article-detail-page">
    <cr7-nav-bar :title="navTitle" />

    <scroll-view
      class="article-scroll"
      scroll-y
      :style="{ paddingTop: navInsetPx + 'px' }"
      :scroll-with-animation="true"
    >
      <view v-if="loading" class="state-wrap">
        <text class="state-text">加载中…</text>
      </view>
      <view v-else-if="errorText" class="state-wrap">
        <text class="state-text">{{ errorText }}</text>
      </view>
      <view v-else-if="article" class="article-body">
        <!-- <image
          v-if="article.cover_url"
          class="cover"
          :src="article.cover_url"
          mode="widthFix"
        /> -->
        <text class="headline">{{ article.title }}</text>
        <text v-if="article.topic && article.topic.title" class="topic-line">{{
          article.topic.title
        }}</text>
        <rich-text :nodes="htmlNodes" class="article-rich-text" />
      </view>
      <view class="safe-bottom safe-area-bottom" />
    </scroll-view>
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { fetchArticleById } from "@/services/article.js";

export default {
  components: {
    Cr7NavBar,
  },
  data() {
    return {
      navInsetPx: 0,
      articleId: "",
      loading: true,
      errorText: "",
      article: null,
    };
  },
  computed: {
    navTitle() {
      return this.article?.title || "文章";
    },
    /** 微信 rich-text：nodes 可为 HTML 字符串（基础库 2.7+） */
    htmlNodes() {
      const c = this.article?.content;
      return typeof c === "string" && c.trim() ? c : "<p></p>";
    },
  },
  onLoad(options) {
    this.navInsetPx = getNavBarInsetPx();
    this.articleId = options.aid || options.id || "";
    this.loadArticle();
  },
  methods: {
    async loadArticle() {
      if (!this.articleId) {
        this.loading = false;
        this.errorText = "缺少文章参数";
        return;
      }
      this.loading = true;
      this.errorText = "";
      this.article = null;
      try {
        const data = await fetchArticleById(this.articleId);
        this.article = data;
      } catch (e) {
        const msg =
          e?.data?.message ||
          e?.errMsg ||
          (typeof e?.message === "string" ? e.message : "") ||
          "加载失败";
        this.errorText = msg;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.article-detail-page {
  min-height: 100vh;
  background: $cr7-black;
}

.article-scroll {
  box-sizing: border-box;
  height: 100vh;
}

.state-wrap {
  padding: 80rpx 40rpx;
  display: flex;
  justify-content: center;
}

.state-text {
  font-size: $font-sm;
  color: $text-light;
}

.article-body {
  padding: 24rpx 30rpx 40rpx;
}

.cover {
  width: 100%;
  display: block;
  border-radius: $radius-md;
  margin-bottom: 24rpx;
}

.headline {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: $text-white;
  line-height: 1.35;
  margin-bottom: 12rpx;
}

.topic-line {
  display: block;
  font-size: $font-xs;
  color: $text-disabled;
  margin-bottom: 24rpx;
}

.article-rich-text {
  font-size: $font-sm;
  color: $text-light;
  line-height: 1.8;
}

.safe-bottom {
  height: 80rpx;
}
</style>
