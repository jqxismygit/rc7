<template>
  <view class="container">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <image :src="userInfo.avatar" class="avatar" mode="aspectFill"></image>
      <view class="user-info">
        <text class="nickname">{{ userInfo.nickname }}</text>
        <text class="phone">{{ userInfo.phone }}</text>
      </view>
      <view v-if="isEmployee" class="employee-badge">员工</view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="menu-item" @click="goToMessages">
        <text class="menu-icon">💬</text>
        <text class="menu-text">消息中心</text>
        <view v-if="unreadCount > 0" class="badge">{{ unreadCount }}</view>
        <text class="arrow">›</text>
      </view>
      
      <view v-if="isEmployee" class="menu-item" @click="goToScan">
        <text class="menu-icon">📷</text>
        <text class="menu-text">扫码验票</text>
        <text class="arrow">›</text>
      </view>
      
      <view class="menu-item" @click="editProfile">
        <text class="menu-icon">👤</text>
        <text class="menu-text">编辑资料</text>
        <text class="arrow">›</text>
      </view>
      
      <view class="menu-item" @click="showInvoice">
        <text class="menu-icon">🧾</text>
        <text class="menu-text">发票管理</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <!-- 其他功能 -->
    <view class="menu-section">
      <view class="menu-item" @click="showAgreement">
        <text class="menu-icon">📄</text>
        <text class="menu-text">协议规则</text>
        <text class="arrow">›</text>
      </view>
      
      <view class="menu-item" @click="contactService">
        <text class="menu-icon">📞</text>
        <text class="menu-text">客服咨询</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-btn" @click="handleLogout">退出登录</button>
    </view>
  </view>
</template>

<script>
import storage from '@/utils/storage.js'
import { mockMessages } from '@/utils/mockData.js'

export default {
  data() {
    return {
      userInfo: {},
      isEmployee: false,
      unreadCount: 0
    }
  },
  
  onShow() {
    this.loadUserInfo()
    this.loadUnreadCount()
  },
  
  methods: {
    loadUserInfo() {
      this.userInfo = storage.getUserInfo() || {}
      this.isEmployee = storage.getIsEmployee()
    },
    
    loadUnreadCount() {
      const unreadMessages = mockMessages.filter(msg => !msg.isRead)
      this.unreadCount = unreadMessages.length
    },
    
    goToMessages() {
      uni.navigateTo({
        url: '/pages/messages/messages'
      })
    },
    
    goToScan() {
      uni.navigateTo({
        url: '/pages/scan-ticket/scan-ticket'
      })
    },
    
    editProfile() {
      uni.showModal({
        title: '编辑资料',
        content: '请输入邮箱地址',
        editable: true,
        placeholderText: this.userInfo.email || '请输入邮箱',
        success: (res) => {
          if (res.confirm && res.content) {
            this.userInfo.email = res.content
            storage.setUserInfo(this.userInfo)
            uni.showToast({
              title: '保存成功',
              icon: 'success'
            })
          }
        }
      })
    },
    
    showInvoice() {
      uni.showToast({
        title: '发票功能开发中',
        icon: 'none'
      })
    },
    
    showAgreement() {
      uni.showModal({
        title: '协议规则',
        content: '隐私政策和服务协议内容...',
        showCancel: false
      })
    },
    
    contactService() {
      uni.showModal({
        title: '客服电话',
        content: '400-123-4567',
        confirmText: '拨打',
        success: (res) => {
          if (res.confirm) {
            uni.makePhoneCall({
              phoneNumber: '4001234567'
            })
          }
        }
      })
    },
    
    handleLogout() {
      uni.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            storage.clear()
            uni.reLaunch({
              url: '/pages/login/login'
            })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 30rpx;
}

.user-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  padding: 40rpx;
  display: flex;
  align-items: center;
  margin-bottom: 30rpx;
  position: relative;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  margin-right: 30rpx;
  border: 4rpx solid rgba(255,255,255,0.3);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.nickname {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.phone {
  font-size: 26rpx;
  color: rgba(255,255,255,0.8);
}

.employee-badge {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  background: rgba(255,255,255,0.3);
  color: #fff;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.menu-section {
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1px solid #f0f0f0;
  position: relative;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.badge {
  background: #ff4444;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  margin-right: 10rpx;
}

.arrow {
  font-size: 40rpx;
  color: #ccc;
}

.logout-section {
  margin-top: 60rpx;
}

.logout-btn {
  width: 100%;
  height: 90rpx;
  background: #fff;
  color: #ff4444;
  border-radius: 16rpx;
  font-size: 28rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: normal;
}

.logout-btn::after {
  border: none;
}
</style>
