<template>
  <view class="container">
    <view v-if="messages.length === 0" class="empty">
      <text class="empty-icon">💬</text>
      <text class="empty-text">暂无消息</text>
    </view>

    <scroll-view v-else class="message-list" scroll-y>
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
import { mockMessages } from '@/utils/mockData.js'

export default {
  data() {
    return {
      messages: []
    }
  },
  
  onLoad() {
    this.loadMessages()
  },
  
  methods: {
    loadMessages() {
      this.messages = mockMessages
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

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.message-list {
  height: 100vh;
}

.message-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  position: relative;
}

.message-item.unread {
  background: #f5f7ff;
}

.message-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.type-ticket {
  background: #e3f2fd;
}

.type-activity {
  background: #fff3e0;
}

.type-system {
  background: #f3e5f5;
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
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}

.message-time {
  font-size: 22rpx;
  color: #999;
}

.message-text {
  font-size: 26rpx;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-dot {
  width: 16rpx;
  height: 16rpx;
  background: #ff4444;
  border-radius: 50%;
  position: absolute;
  right: 30rpx;
  top: 50%;
  transform: translateY(-50%);
}
</style>
