<template>
  <view class="container">
    <view v-if="messages.length === 0" class="empty">
      <text class="empty-icon">💬</text>
      <text class="empty-text">暂无消息</text>
    </view>

    <scroll-view v-else class="message-list safe-area-bottom" scroll-y>
      <view 
        v-for="msg in messages" 
        :key="msg.id"
        class="message-item"
        :class="{ unread: !msg.isRead }"
        @click="handleMessageClick(msg)"
      >
        <view class="message-icon" :class="'type-' + msg.type">
          {{ getTypeIcon(msg.type) }}
        </view>
        <view class="message-content">
          <view class="message-header">
            <text class="message-title">{{ msg.title }}</text>
            <text class="message-time">{{ formatTime(msg.time) }}</text>
          </view>
          <text class="message-text">{{ msg.content }}</text>
        </view>
        <view v-if="!msg.isRead" class="unread-dot"></view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { fetchMessages } from '@/services/messages.js'

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
        activity: '📅',
        system: '🔔'
      }
      return iconMap[type] || '💬'
    },
    
    formatTime(time) {
      const date = new Date(time)
      const now = new Date()
      const diff = now - date
      
      if (diff < 3600000) { // 1小时内
        return Math.floor(diff / 60000) + '分钟前'
      } else if (diff < 86400000) { // 24小时内
        return Math.floor(diff / 3600000) + '小时前'
      } else {
        return time.split(' ')[0]
      }
    },
    
    handleMessageClick(msg) {
      if (!msg.isRead) {
        msg.isRead = true
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

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
  color: $text-light;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  font-size: $font-base;
}

.message-list {
  height: 100vh;
}

.message-item {
  display: flex;
  align-items: center;
  padding: 30rpx 32rpx;
  background: $cr7-card;
  border-bottom: 1rpx solid $cr7-border;
  position: relative;
}

.message-item.unread {
  background: rgba(216, 252, 15, 0.06);
}

.message-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
  background: $cr7-dark;
  box-shadow: $shadow-card;
}

.type-ticket {
  background: radial-gradient(circle at 0% 0%, rgba(216, 252, 15, 0.3), transparent 55%), $cr7-dark;
}

.type-activity {
  background: radial-gradient(circle at 0% 0%, rgba(243, 156, 18, 0.3), transparent 55%), $cr7-dark;
}

.type-system {
  background: radial-gradient(circle at 0% 0%, rgba(217, 0, 27, 0.3), transparent 55%), $cr7-dark;
}

.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message-title {
  font-size: $font-md;
  font-weight: 600;
  color: $text-white;
}

.message-time {
  font-size: $font-xs;
  color: $text-muted;
}

.message-text {
  font-size: $font-sm;
  color: $text-light;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-dot {
  width: 18rpx;
  height: 18rpx;
  background: $cr7-gold;
  border-radius: 50%;
  position: absolute;
  right: 32rpx;
  top: 50%;
  transform: translateY(-50%);
  box-shadow: $shadow-gold;
}
</style>
