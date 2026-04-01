<template>
  <view class="container">
    <cr7-nav-bar title="消息中心" />

    <!-- 空状态（Figma 68242:13918，图标为占位，后续可换正式资源） -->
    <view
      v-if="messages.length === 0 && !loading"
      class="empty"
      :style="{ paddingTop: navInsetPx + 'px' }"
    >
      <view class="empty-inner">
        <view class="empty-illustration">
          <view class="empty-icon-halo" aria-hidden="true" />
          <view class="empty-icon-ring">
            <sx-svg
              class="empty-msg-icon-svg"
              name="no-message"
              :width="84"
              :height="84"
              color="#D8FC0F"
            />
          </view>
        </view>
        <view class="empty-copy">
          <text class="empty-title">暂无消息</text>
        </view>
        <button
          class="btn-gold empty-btn"
          hover-class="none"
          @click="goExplore"
        >
          去探索活动
        </button>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view
      v-else
      class="message-list"
      scroll-y
      :style="{ paddingTop: navInsetPx + 'px' }"
    >
      <view
        v-for="msg in messages"
        :key="msg.id"
        class="message-card"
        @click="handleMessageClick(msg)"
      >
        <view class="msg-header">
          <view class="msg-title-row">
            <view class="msg-title-inner">
              <text class="msg-title">{{ msg.title }}</text>
            </view>
            <view v-if="!msg.isRead" class="unread-dot" />
          </view>
          <text class="msg-time">{{ formatTime(msg.time) }}</text>
        </view>
        <view class="msg-preview">
          <text class="msg-text">{{ msg.content }}</text>
        </view>
      </view>
      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
import { fetchMessages, markMessageAsRead } from "@/services/messages.js";
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";

export default {
  components: {
    Cr7NavBar,
  },

  data() {
    return {
      messages: [],
      loading: false,
      navInsetPx: 0,
    };
  },

  async onLoad() {
    this.navInsetPx = getNavBarInsetPx();
    await this.loadMessages();
  },

  methods: {
    async loadMessages() {
      this.loading = true;
      try {
        // const list = await fetchMessages();
        // this.messages = list;
      } catch (e) {
        console.error("加载消息列表失败", e);
        uni.showToast({
          title: "消息加载失败",
          icon: "none",
        });
      } finally {
        this.loading = false;
      }
    },

    formatTime(time) {
      const date = new Date(time);
      const now = new Date();
      const diff = now - date;

      if (diff < 3600000) {
        return Math.floor(diff / 60000) + "分钟前";
      } else if (diff < 86400000) {
        return Math.floor(diff / 3600000) + "小时前";
      } else if (diff < 172800000) {
        return "昨天";
      } else if (diff < 604800000) {
        const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        return days[date.getDay()];
      } else {
        return time.split(" ")[0];
      }
    },

    goExplore() {
      uni.switchTab({ url: "/pages/index/index" });
    },

    async handleMessageClick(msg) {
      if (!msg.isRead) {
        msg.isRead = true;
        try {
          await markMessageAsRead(msg.id);
        } catch (e) {
          console.error("标记已读失败", e);
        }
      }

      uni.showModal({
        title: msg.title,
        content: msg.content,
        showCancel: false,
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: $cr7-black;
}

/* 空状态（与票夹空状态同结构，Figma 68242:13918） */
.empty {
  min-height: 100vh;
  box-sizing: border-box;
  padding-left: 62rpx;
  padding-right: 62rpx;
  padding-bottom: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-inner {
  flex: 1;
  width: 100%;
  max-width: 620rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-bottom: 120rpx;
}

.empty-illustration {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 62rpx;
}

.empty-icon-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 277rpx;
  height: 277rpx;
  margin: -138rpx 0 0 -138rpx;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(216, 252, 15, 0.12) 0%,
    rgba(216, 252, 15, 0) 70%
  );
  pointer-events: none;
}

.empty-icon-ring {
  position: relative;
  width: 185rpx;
  height: 185rpx;
  border-radius: 50%;
  background: #20230f;
  border: 2rpx solid rgba(255, 255, 255, 0.05);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 48rpx 96rpx -23rpx rgba(0, 0, 0, 0.25);
}

.empty-msg-icon-svg {
  position: relative;
  z-index: 1;
  width: 84rpx;
  height: 84rpx;
}

.empty-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 158rpx;
}

.empty-title {
  font-size: 40rpx;
  font-weight: 400;
  color: $text-white;
  line-height: 62rpx;
  letter-spacing: -1.15rpx;
  text-align: center;
}

.empty-btn {
  width: 331rpx;
  height: 81rpx;
  border-radius: 52rpx;
  font-size: 32rpx;
  font-weight: 400;
  line-height: 1;
  margin-top: 0;
}

/* 消息列表 */
.message-list {
  height: 100vh;
  box-sizing: border-box;
}

.message-card {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 31rpx;
  margin: 0 31rpx 15rpx;
  background: $cr7-dark;
  border-radius: 24rpx;
}

.message-card:first-child {
  margin-top: 31rpx;
}

.msg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.msg-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
  min-width: 0;
  flex: 1;
}

/* 标题按文字宽度占位，可缩小省略；小点紧跟标题末尾，不再被 flex:1 挤到最右侧 */
.msg-title-inner {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
}

.msg-title {
  font-size: $font-md;
  font-weight: 500;
  color: $text-white;
  line-height: 46rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-dot {
  width: 15rpx;
  height: 15rpx;
  margin-top: 4rpx;
  background: $cr7-gold;
  border-radius: 50%;
  flex-shrink: 0;
}

.msg-time {
  font-size: 23rpx;
  color: $text-light;
  line-height: 30rpx;
  flex-shrink: 0;
}

.msg-preview {
  height: 88rpx;
  overflow: hidden;
}

.msg-text {
  font-size: 27rpx;
  font-weight: 500;
  color: $text-light;
  line-height: 44rpx;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}

.safe-bottom {
  height: 40rpx;
}
</style>
