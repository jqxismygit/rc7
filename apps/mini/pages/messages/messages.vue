<template>
  <view class="container">
    <!-- 自定义导航栏 -->
    <view class="nav-bar safe-area-top">
      <view class="nav-back" @click="goBack">
        <text class="nav-back-icon">‹</text>
      </view>
      <text class="nav-title">消息中心</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 空状态 -->
    <view v-if="messages.length === 0 && !loading" class="empty">
      <text class="empty-icon">💬</text>
      <text class="empty-text">暂无消息</text>
    </view>

    <!-- 消息列表 -->
    <scroll-view v-else class="message-list" scroll-y>
      <view
        v-for="msg in messages"
        :key="msg.id"
        class="message-card"
        @click="handleMessageClick(msg)"
      >
        <view class="msg-avatar" :class="'avatar-' + msg.type">
          <text class="msg-avatar-icon">{{ getTypeIcon(msg.type) }}</text>
        </view>
        <view class="msg-body">
          <view class="msg-header">
            <view class="msg-title-row">
              <text class="msg-title">{{ msg.title }}</text>
              <view v-if="!msg.isRead" class="unread-dot"></view>
            </view>
            <text class="msg-time">{{ formatTime(msg.time) }}</text>
          </view>
          <view class="msg-preview">
            <text class="msg-text">{{ msg.content }}</text>
          </view>
        </view>
      </view>
      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
import {
  fetchMessages,
  markMessageAsRead
} from '@/services/messages.js'

export default {
  data() {
    return {
      messages: [],
      loading: false
    }
  },

  async onLoad() {
    await this.loadMessages()
  },

  methods: {
    goBack() {
      if (getCurrentPages().length > 1) {
        uni.navigateBack()
      } else {
        uni.switchTab({ url: '/pages/index/index' })
      }
    },

    async loadMessages() {
      this.loading = true
      try {
        const list = await fetchMessages()
        this.messages = list
      } catch (e) {
        console.error('加载消息列表失败', e)
        uni.showToast({
          title: '消息加载失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    getTypeIcon(type) {
      const iconMap = {
        ticket: '🎫',
        activity: '🎁',
        system: '⚙️'
      }
      return iconMap[type] || '💬'
    },

    formatTime(time) {
      const date = new Date(time)
      const now = new Date()
      const diff = now - date

      if (diff < 3600000) {
        return Math.floor(diff / 60000) + '分钟前'
      } else if (diff < 86400000) {
        return Math.floor(diff / 3600000) + '小时前'
      } else if (diff < 172800000) {
        return '昨天'
      } else if (diff < 604800000) {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        return days[date.getDay()]
      } else {
        return time.split(' ')[0]
      }
    },

    async handleMessageClick(msg) {
      if (!msg.isRead) {
        msg.isRead = true
        try {
          await markMessageAsRead(msg.id)
        } catch (e) {
          console.error('标记已读失败', e)
        }
      }

      uni.showModal({
        title: msg.title,
        content: msg.content,
        showCancel: false
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: $cr7-black;
}

/* 导航栏 */
.nav-bar {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  padding: 0 $spacing-lg;
  padding-top: 56rpx;
  height: 196rpx;
  display: flex;
  align-items: center;
  z-index: 20;
  background: $cr7-black;
}

.nav-back {
  width: 70rpx;
  height: 70rpx;
  border-radius: 40rpx;
  background: $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-back-icon {
  color: $text-white;
  font-size: 40rpx;
  margin-top: -4rpx;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  color: $text-white;
  font-weight: 700;
}

.nav-placeholder {
  width: 70rpx;
  height: 70rpx;
}

/* 空状态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 400rpx;
  color: $text-light;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  font-size: $font-base;
}

/* 消息列表 */
.message-list {
  height: 100vh;
  padding-top: 196rpx;
}

.message-card {
  display: flex;
  gap: 30rpx;
  align-items: flex-start;
  padding: 30rpx;
  margin: 0 30rpx 15rpx;
  background: $cr7-dark;
  border-radius: 24rpx;
}

.message-card:first-child {
  margin-top: 30rpx;
}

/* 头像 */
.msg-avatar {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: $cr7-gold;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.msg-avatar-icon {
  font-size: 42rpx;
}

.avatar-activity {
  background: $cr7-gold;
}

.avatar-system {
  background: rgba(216, 251, 14, 0.2);
}

.avatar-ticket {
  background: rgba(216, 251, 14, 0.2);
}

/* 消息内容 */
.msg-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.msg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.msg-title-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.msg-title {
  font-size: $font-md;
  font-weight: 500;
  color: $text-white;
  line-height: 46rpx;
}

.unread-dot {
  width: 16rpx;
  height: 16rpx;
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
  color: $text-light;
  line-height: 44rpx;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}

.safe-bottom {
  height: 40rpx;
}
</style>
