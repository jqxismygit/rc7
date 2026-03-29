<template>
  <view class="brands-page">
    <cr7-nav-bar title="合作伙伴" />

    <scroll-view
      class="brands-scroll"
      scroll-y
      :style="{ paddingTop: navInsetPx + 'px' }"
    >
      <view v-if="loading" class="state-wrap">
        <text class="state-text">加载中…</text>
      </view>
      <view v-else-if="errorText" class="state-wrap">
        <text class="state-text">{{ errorText }}</text>
      </view>
      <view v-else class="brands-inner">
        <view v-if="!brands.length" class="state-wrap">
          <text class="state-text">暂无合作伙伴内容</text>
        </view>
        <view v-else class="brand-grid">
          <view
            v-for="brand in brands"
            :key="brand.id"
            class="brand-card"
            @click="openPartnerArticle(brand)"
          >
            <view class="brand-cover-area">
              <image
                :src="brand.logo || '/static/images/event-card.jpg'"
                class="brand-cover-img"
                mode="aspectFill"
              />
            </view>
            <text class="brand-name">{{ brand.name }}</text>
            <text class="brand-desc">{{ brand.description }}</text>
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
import { mapArticlesToPartnerBrands } from "@/utils/partner-articles.js";

export default {
  components: { Cr7NavBar },
  data() {
    return {
      navInsetPx: 0,
      loading: true,
      errorText: "",
      brands: [],
    };
  },
  onLoad() {
    this.navInsetPx = getNavBarInsetPx();
    this.loadList();
  },
  methods: {
    async loadList() {
      const tid = String(HOME_TOPIC_IDS.brands || "").trim();
      if (!tid) {
        this.loading = false;
        this.errorText = "未配置合作伙伴话题";
        return;
      }
      this.loading = true;
      this.errorText = "";
      try {
        const topic = await fetchTopicWithArticles(tid);
        const articles = Array.isArray(topic?.articles) ? topic.articles : [];
        this.brands = mapArticlesToPartnerBrands(articles);
      } catch (e) {
        const msg =
          e?.data?.message ||
          e?.errMsg ||
          (typeof e?.message === "string" ? e.message : "") ||
          "加载失败";
        this.errorText = msg;
        this.brands = [];
      } finally {
        this.loading = false;
      }
    },
    openPartnerArticle(brand) {
      if (!brand?.id) return;
      uni.navigateTo({
        url: `/pages/article-detail/article-detail?aid=${encodeURIComponent(brand.id)}`,
      });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.brands-page {
  min-height: 100vh;
  background: $cr7-black;
}

.brands-scroll {
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

.brands-inner {
  padding: 24rpx 36rpx 0;
  box-sizing: border-box;
}

.brand-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}

.brand-card {
  width: calc((100% - 24rpx) / 2);
  max-width: 328rpx;
  height: 300rpx;
  background: $cr7-dark;
  border-radius: 28rpx;
  padding: 14rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand-cover-area {
  width: 100%;
  height: 163rpx;
  background: $cr7-card;
  border-radius: 17rpx;
  overflow: hidden;
  flex-shrink: 0;
  margin-bottom: 21rpx;
}

.brand-cover-img {
  width: 100%;
  height: 100%;
}

.brand-name {
  display: block;
  font-size: 30rpx;
  font-weight: 500;
  color: $text-white;
  text-align: center;
  line-height: 42rpx;
  margin-bottom: 2rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.brand-desc {
  display: block;
  font-size: 24rpx;
  color: $text-light;
  text-align: center;
  line-height: 38rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.safe-bottom {
  height: 80rpx;
}
</style>
