<template>
  <view class="news-all-page">
    <cr7-nav-bar title="全部新闻" />

    <scroll-view
      class="news-all-scroll"
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
      <view v-else class="news-all-inner">
        <view v-if="!list.length" class="state-wrap">
          <text class="state-text">暂无新闻</text>
        </view>
        <view v-else class="news-list">
          <view
            v-for="item in list"
            :key="item.id"
            class="news-card"
            @click="openArticle(item)"
          >
            <view class="news-thumb">
              <image
                :src="item.cover || '/static/images/event-card.jpg'"
                class="news-thumb-img"
                mode="aspectFill"
              />
            </view>
            <view class="news-content">
              <text class="news-title">{{ item.title }}</text>
              <text class="news-desc">{{ item.desc }}</text>
            </view>
            <image
              src="/static/icons/arrow-right.svg"
              class="news-arrow"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>
      <view class="safe-bottom safe-area-bottom" />
    </scroll-view>
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { HOME_TOPIC_IDS } from "@/config/home-topic-ids.js";
import { fetchTopicWithArticles } from "@/services/topic.js";

export default {
  components: { Cr7NavBar },
  data() {
    return {
      navInsetPx: 0,
      loading: true,
      errorText: "",
      list: [],
    };
  },
  onLoad() {
    this.navInsetPx = getNavBarInsetPx();
    this.loadList();
  },
  methods: {
    async loadList() {
      const tid = String(HOME_TOPIC_IDS.news || "").trim();
      if (!tid) {
        this.loading = false;
        this.errorText = "未配置新闻话题";
        return;
      }
      this.loading = true;
      this.errorText = "";
      try {
        const topic = await fetchTopicWithArticles(tid);
        const articles = Array.isArray(topic?.articles) ? topic.articles : [];
        this.list = articles.map((a) => {
          const title = a.title || "";
          return {
            id: a.id,
            cover: a.cover_url || "",
            title,
            desc: title,
          };
        });
      } catch (e) {
        const msg =
          e?.data?.message ||
          e?.errMsg ||
          (typeof e?.message === "string" ? e.message : "") ||
          "加载失败";
        this.errorText = msg;
        this.list = [];
      } finally {
        this.loading = false;
      }
    },
    openArticle(item) {
      if (!item?.id) return;
      uni.navigateTo({
        url: `/pages/article-detail/article-detail?aid=${encodeURIComponent(item.id)}`,
      });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.news-all-page {
  min-height: 100vh;
  background: $cr7-black;
}

.news-all-scroll {
  box-sizing: border-box;
  height: 100vh;
}

.state-wrap {
  padding: 80rpx 35rpx;
  display: flex;
  justify-content: center;
}

.state-text {
  font-size: 28rpx;
  color: $text-disabled;
}

.news-all-inner {
  padding: 35rpx 35rpx 0;
  box-sizing: border-box;
}

.news-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.news-card {
  display: flex;
  align-items: center;
  height: 170rpx;
  background: $cr7-dark;
  border-radius: 28rpx;
  padding: 14rpx;
  box-sizing: border-box;
}

.news-thumb {
  width: 189rpx;
  height: 142rpx;
  border-radius: 17rpx;
  overflow: hidden;
  flex-shrink: 0;
  margin-right: 21rpx;
  border: 1rpx solid $cr7-border;
}

.news-thumb-img {
  width: 100%;
  height: 100%;
}

.news-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7rpx;
}

.news-title {
  font-size: 29rpx;
  font-weight: 500;
  color: $text-white;
  line-height: 42rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.news-desc {
  font-size: 24rpx;
  color: $text-disabled;
  line-height: 38rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.news-arrow {
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
}

.safe-bottom {
  height: 80rpx;
}
</style>
