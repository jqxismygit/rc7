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
        <!-- <text class="headline">{{ article.title }}</text>
        <text v-if="article.topic && article.topic.title" class="topic-line">{{
          article.topic.title
        }}</text> -->
        <block v-for="block in contentBlocks" :key="block.key">
          <rich-text
            v-if="block.type === 'html'"
            :nodes="block.html"
            class="article-rich-text"
          />
          <video
            v-else
            class="article-inline-video"
            :src="block.src"
            :poster="block.poster"
            controls
            show-center-play-btn
            enable-progress-gesture
            object-fit="contain"
          />
        </block>
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
    rawContent() {
      const c = this.article?.content;
      return typeof c === "string" && c.trim() ? c : "<p></p>";
    },
    contentBlocks() {
      return splitArticleContent(this.rawContent);
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

function splitArticleContent(html) {
  if (!html || typeof html !== "string") {
    return [{ key: "html-0", type: "html", html: "<p></p>" }];
  }

  const blocks = [];
  const videoRegex =
    /<div[^>]*>\s*<video\b[\s\S]*?<\/video>\s*<\/div>|<video\b[\s\S]*?<\/video>/gi;
  let lastIndex = 0;
  let matchIndex = 0;
  let match;

  while ((match = videoRegex.exec(html)) !== null) {
    const before = html.slice(lastIndex, match.index);
    if (before.trim()) {
      blocks.push({
        key: `html-${matchIndex}`,
        type: "html",
        html: before,
      });
    }

    const videoHtml = match[0];
    const src =
      extractVideoAttr(videoHtml, "src") || extractVideoSourceSrc(videoHtml);

    if (src) {
      blocks.push({
        key: `video-${matchIndex}`,
        type: "video",
        src,
        poster: extractVideoAttr(videoHtml, "poster") || "",
      });
    } else {
      blocks.push({
        key: `html-fallback-${matchIndex}`,
        type: "html",
        html: videoHtml,
      });
    }

    lastIndex = match.index + videoHtml.length;
    matchIndex += 1;
  }

  const tail = html.slice(lastIndex);
  if (tail.trim()) {
    blocks.push({
      key: `html-tail-${matchIndex}`,
      type: "html",
      html: tail,
    });
  }

  return blocks.length
    ? blocks
    : [{ key: "html-0", type: "html", html: "<p></p>" }];
}

function extractVideoAttr(videoHtml, attr) {
  const matched = videoHtml.match(
    new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return matched?.[1] || "";
}

function extractVideoSourceSrc(videoHtml) {
  const matched = videoHtml.match(/<source\b[^>]*src\s*=\s*["']([^"']+)["']/i);
  return matched?.[1] || "";
}
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
  padding: 30rpx 30rpx 40rpx;
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
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.article-rich-text :deep(view),
.article-rich-text :deep(text),
.article-rich-text :deep(p),
.article-rich-text :deep(div),
.article-rich-text :deep(span),
.article-rich-text :deep(a),
.article-rich-text :deep(img) {
  max-width: 100%;
  box-sizing: border-box;
  white-space: normal !important;
  word-break: break-word !important;
  overflow-wrap: anywhere;
}

.article-inline-video {
  display: block;
  width: 100%;
  border-radius: 16rpx;
  background: #000;
  margin: 24rpx 0;
}

.safe-bottom {
  height: 80rpx;
}
</style>
