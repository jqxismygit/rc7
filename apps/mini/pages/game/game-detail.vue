<template>
  <view class="game-detail-page">
    <cr7-nav-bar
      :title="pageTitle"
      fallback-url="/pages/game/game"
      :show-back="true"
    />
    <view class="web-view-wrap" :style="{ top: navInsetPx + 'px' }">
      <web-view
        v-if="h5Url"
        class="game-web-view"
        :src="h5Url"
        @message="onWebViewMessage"
      />
      <view v-else class="empty">
        <text class="empty-text">未配置 H5 地址</text>
        <text class="empty-hint"
          >请在 apps/mini/config/game-h5-url.js 中设置 DEFAULT_GAME_H5_URL</text
        >
        <text class="empty-hint">或从互动页以 ?url= 参数传入</text>
      </view>
    </view>
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { DEFAULT_GAME_H5_URL } from "@/config/game-h5-url.js";
import {
  appendUserQueryToH5Url,
  mergeUserForH5,
  pickUserFromStore,
} from "@/utils/gameH5User.js";

export default {
  components: { Cr7NavBar },
  data() {
    return {
      navInsetPx: 0,
      h5Url: "",
      pageTitle: "互动",
    };
  },
  onLoad(options) {
    this.navInsetPx = getNavBarInsetPx();
    const fromQuery = options.url
      ? decodeURIComponent(String(options.url).trim())
      : "";
    const base = (fromQuery || DEFAULT_GAME_H5_URL || "").trim();
    const user = mergeUserForH5(options, pickUserFromStore());
    this.h5Url = appendUserQueryToH5Url(base, user);
    if (options.title) {
      this.pageTitle = decodeURIComponent(String(options.title).trim());
    }
  },
  methods: {
    onWebViewMessage() {
      // 预留：H5 内 postMessage 可在此处理
    },
  },
};
</script>

<style lang="scss" scoped>
.game-detail-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.web-view-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: $cr7-black;
}

.game-web-view {
  width: 100%;
  height: 100%;
}

.empty {
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.empty-text {
  font-size: 30rpx;
  color: $text-white;
  font-weight: 600;
}

.empty-hint {
  font-size: 24rpx;
  color: $text-muted;
  line-height: 1.5;
}
</style>
