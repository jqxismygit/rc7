<template>
  <view class="profile-page">
    <!-- 头部用户信息 -->
    <view class="user-card card-dark">
      <image :src="userInfo.avatar" class="avatar" mode="aspectFill" />
      <view class="user-info">
        <text class="nickname">{{ userInfo.nickname || '_weixin_user' }}</text>
        <text class="sub-text">微信登录 · CR7® LIFE 会员</text>
      </view>
      <view v-if="isEmployee" class="employee-badge">员工</view>
    </view>

    <!-- 我的订单入口 -->
    <view class="menu-section card-dark">
      <view class="menu-item" @click="goToTickets">
        <text class="menu-icon">🎫</text>
        <view class="menu-main">
          <text class="menu-text">我的订单 / 票夹</text>
          <text class="menu-sub">查看已购票券与参观记录</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 功能列表：消息中心 / 扫码验票 / 发票抬头 -->
    <view class="menu-section card-dark">
      <view class="menu-item" @click="goToMessages">
        <text class="menu-icon">💬</text>
        <view class="menu-main">
          <text class="menu-text">消息中心</text>
          <text class="menu-sub">订单状态与活动通知</text>
        </view>
        <view v-if="unreadCount > 0" class="badge">{{ unreadCount }}</view>
        <text class="menu-arrow">›</text>
      </view>

      <view v-if="isEmployee" class="menu-item" @click="goToScan">
        <text class="menu-icon">📷</text>
        <view class="menu-main">
          <text class="menu-text">扫码验票</text>
          <text class="menu-sub">员工专用核销入口</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @click="editInvoice">
        <text class="menu-icon">🧾</text>
        <view class="menu-main">
          <text class="menu-text">发票抬头</text>
          <text class="menu-sub">{{ invoiceTitle || '填写公司或个人发票信息' }}</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 协议 / 联系客服 -->
    <view class="menu-section card-dark">
      <view class="menu-item" @click="goToLegal('privacy')">
        <text class="menu-icon">🔒</text>
        <text class="menu-text">隐私政策</text>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @click="goToLegal('terms')">
        <text class="menu-icon">📄</text>
        <text class="menu-text">服务协议</text>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @click="contactService">
        <text class="menu-icon">📞</text>
        <view class="menu-main">
          <text class="menu-text">联系客服</text>
          <text class="menu-sub">010-88888888</text>
        </view>
        <text class="menu-arrow">›</text>
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
import { fetchUnreadCount } from '@/services/messages.js'

export default {
  data() {
    return {
      userInfo: {},
      isEmployee: false,
      unreadCount: 0,
      invoiceTitle: ''
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
      this.invoiceTitle = storage.get('invoiceTitle') || ''
    },

    async loadUnreadCount() {
      try {
        const count = await fetchUnreadCount()
        this.unreadCount = count
      } catch (e) {
        console.error('加载未读消息数量失败', e)
      }
    },

    goToTickets() {
      uni.switchTab({
        url: '/pages/my-tickets/my-tickets'
      })
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

    editInvoice() {
      // 优先拉起微信发票抬头管理能力，失败时退回手动输入
      // #ifdef MP-WEIXIN
      if (wx && wx.chooseInvoiceTitle) {
        wx.chooseInvoiceTitle({
          success: (res) => {
            const title = res?.title || res?.company || ''
            if (title) {
              this.invoiceTitle = title
              storage.set('invoiceTitle', title)
              uni.showToast({
                title: '已同步微信发票抬头',
                icon: 'success'
              })
              return
            }
          },
          fail: () => {
            this.openInvoiceTitleModal()
          }
        })
        return
      }
      // #endif
      this.openInvoiceTitleModal()
    },

    openInvoiceTitleModal() {
      uni.showModal({
        title: '发票抬头',
        content: '请输入发票抬头（公司或个人姓名）',
        editable: true,
        placeholderText: this.invoiceTitle || '示例：北京某某科技有限公司',
        success: (res) => {
          if (res.confirm && res.content) {
            this.invoiceTitle = res.content
            storage.set('invoiceTitle', res.content)
            uni.showToast({
              title: '已保存',
              icon: 'success'
            })
          }
        }
      })
    },

    goToLegal(type) {
      const url =
        type === 'privacy'
          ? '/pages/legal/privacy'
          : '/pages/legal/terms'
      uni.navigateTo({ url })
    },

    contactService() {
      // 微信小程序内优先使用微信客服能力
      // #ifdef MP-WEIXIN
      if (wx && wx.openCustomerServiceChat) {
        wx.openCustomerServiceChat({
          extInfo: { url: '' },
          corpId: '',
          success: () => {},
          fail: () => {
            this.openPhoneServiceModal()
          }
        })
        return
      }
      // #endif
      this.openPhoneServiceModal()
    },

    openPhoneServiceModal() {
      uni.showModal({
        title: '客服电话',
        content: '010-88888888',
        confirmText: '拨打',
        success: (res) => {
          if (res.confirm) {
            uni.makePhoneCall({
              phoneNumber: '01088888888'
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

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: $cr7-black;
  padding: 24rpx 24rpx 0;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.user-card {
  margin-top: 16rpx;
  padding: 32rpx 28rpx;
  display: flex;
  align-items: center;
  position: relative;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-right: 24rpx;
  border: 3rpx solid rgba(216, 252, 15, 0.6);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.nickname {
  font-size: $font-lg;
  color: $text-white;
  font-weight: 600;
}

.sub-text {
  margin-top: 4rpx;
  font-size: $font-sm;
  color: $text-light;
}

.employee-badge {
  position: absolute;
  right: 20rpx;
  top: 24rpx;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(216, 252, 15, 0.24);
  color: $cr7-gold-light;
  font-size: $font-xs;
}

.menu-section {
  margin-top: 24rpx;
  overflow: hidden;
}

.menu-item {
  padding: 24rpx 24rpx;
  display: flex;
  align-items: center;
  border-bottom: 1rpx solid $cr7-border;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.menu-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.menu-text {
  font-size: $font-md;
  color: $text-white;
}

.menu-sub {
  margin-top: 4rpx;
  font-size: $font-xs;
  color: $text-muted;
}

.menu-arrow {
  font-size: 36rpx;
  color: $text-muted;
  margin-left: 8rpx;
}

.badge {
  background: $cr7-red;
  color: #fff;
  font-size: $font-xs;
  padding: 4rpx 10rpx;
  border-radius: 24rpx;
  margin-right: 4rpx;
}

.logout-section {
  margin: 56rpx 0 40rpx;
}

.logout-btn {
  width: 100%;
  height: 88rpx;
  background: transparent;
  border-radius: $radius-md;
  border: 1rpx solid $cr7-red;
  color: $cr7-red;
  font-size: $font-md;
  line-height: normal;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-btn::after {
  border: none;
}
</style>
