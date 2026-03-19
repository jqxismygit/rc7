<template>
  <view class="profile-page">
    <!-- 顶部导航 -->
    <view
      class="profile-navbar"
      :style="{ paddingTop: statusBarHeight + 'px' }"
    >
      <view class="navbar-row">
        <view class="navbar-left">
          <!-- <view class="city-switch" @click="openCityPicker">
            <text class="city-name">{{ currentCity }}</text>
            <image
              src="/static/icons/arrow-down.svg"
              class="city-arrow-icon"
              mode="aspectFit"
            />
          </view> -->
          <view class="navbar-notification" @click="goToMessages">
            <image
              src="/static/icons/notification.svg"
              class="nav-icon"
              mode="aspectFit"
            />
            <view v-if="unreadCount > 0" class="notification-dot"></view>
          </view>
        </view>
        <view class="navbar-logo">
          <image
            src="/static/icons/logo.svg"
            class="logo-img"
            mode="aspectFit"
          />
        </view>
      </view>
    </view>

    <scroll-view
      class="profile-scroll"
      scroll-y
      enhanced
      :show-scrollbar="false"
    >
      <!-- 用户信息 -->
      <view class="user-section" @click="goToProfileEdit">
        <view class="avatar-wrap">
          <image
            :src="userInfo.avatar || '/static/images/avatar-default.png'"
            class="avatar"
            mode="aspectFill"
          />
          <view class="camera-btn">
            <image
              src="/static/icons/camera.svg"
              class="camera-icon"
              mode="aspectFit"
            />
          </view>
        </view>
        <view class="user-name-row">
          <text class="nickname">{{ userInfo.nickname || "用户" }}</text>
          <view v-if="isEmployee" class="employee-tag">
            <text class="employee-tag-text">工作人员</text>
          </view>
        </view>
        <text class="login-method">微信登录</text>
      </view>

      <!-- 功能列表 -->
      <view class="menu-list">
        <view class="menu-item" @click="goToTickets">
          <view class="menu-icon-wrap">
            <image
              src="/static/icons/ticket.svg"
              class="menu-icon"
              mode="aspectFit"
            />
          </view>
          <text class="menu-text">我的票夹</text>
          <image
            src="/static/icons/arrow-right.svg"
            class="menu-arrow"
            mode="aspectFit"
          />
        </view>

        <view class="menu-item" @click="goToMessages">
          <view class="menu-icon-wrap">
            <image
              src="/static/icons/notification.svg"
              class="menu-icon"
              mode="aspectFit"
            />
          </view>
          <text class="menu-text">消息中心</text>
          <view v-if="unreadCount > 0" class="menu-badge">{{
            unreadCount
          }}</view>
          <image
            src="/static/icons/arrow-right.svg"
            class="menu-arrow"
            mode="aspectFit"
          />
        </view>

        <view class="menu-item" @click="editInvoice">
          <view class="menu-icon-wrap">
            <image
              src="/static/icons/language.svg"
              class="menu-icon"
              mode="aspectFit"
            />
          </view>
          <text class="menu-text">发票抬头</text>
          <image
            src="/static/icons/arrow-right.svg"
            class="menu-arrow"
            mode="aspectFit"
          />
        </view>

        <view class="menu-item" @click="goToLegal">
          <view class="menu-icon-wrap">
            <image
              src="/static/icons/document.svg"
              class="menu-icon"
              mode="aspectFit"
            />
          </view>
          <text class="menu-text">隐私政策/服务协议</text>
          <image
            src="/static/icons/arrow-right.svg"
            class="menu-arrow"
            mode="aspectFit"
          />
        </view>

        <view class="menu-item" @click="contactService">
          <view class="menu-icon-wrap">
            <image
              src="/static/icons/phone.svg"
              class="menu-icon"
              mode="aspectFit"
            />
          </view>
          <text class="menu-text">联系客服</text>
          <image
            src="/static/icons/arrow-right.svg"
            class="menu-arrow"
            mode="aspectFit"
          />
        </view>
      </view>

      <!-- 退出登录 -->
      <view class="logout-area" @click="handleLogout">
        <image
          src="/static/icons/logout.svg"
          class="logout-icon"
          mode="aspectFit"
        />
        <text class="logout-text">退出登录</text>
      </view>

      <!-- 底部占位 -->
      <view class="bottom-spacer"></view>
    </scroll-view>

    <!-- 城市选择弹层 -->
    <view v-if="showCityPicker" class="city-modal" @click="closeCityPicker">
      <view class="city-panel" @click.stop>
        <text class="city-panel-title">选择城市</text>
        <view class="city-list">
          <view
            v-for="city in cityList"
            :key="city"
            :class="['city-item', { active: city === currentCity }]"
            @click="chooseCity(city)"
          >
            {{ city }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { useUserStore } from "@/stores/user";
import { fetchUnreadCount } from "@/services/messages.js";
import createTabBarMixin from "@/mixins/tabBar.js";

export default {
  mixins: [createTabBarMixin(3)],
  data() {
    return {
      statusBarHeight: 0,
      userInfo: {},
      isEmployee: false,
      unreadCount: 0,
      invoiceTitle: "",
      currentCity: "上海",
      cityList: ["北京", "上海", "中国香港", "深圳"],
      showCityPicker: false,
    };
  },

  onLoad() {
    const systemInfo = uni.getSystemInfoSync();
    this.statusBarHeight = systemInfo.statusBarHeight || 0;
  },

  onShow() {
    this.loadUserInfo();
    this.loadUnreadCount();
  },

  methods: {
    loadUserInfo() {
      const userStore = useUserStore();
      this.userInfo = userStore.profile || {};
      this.isEmployee = userStore.isEmployee;
      this.invoiceTitle = userStore.invoiceTitle || "";
    },

    async loadUnreadCount() {
      try {
        const count = await fetchUnreadCount();
        this.unreadCount = count;
      } catch (e) {
        console.error("加载未读消息数量失败", e);
      }
    },

    goToProfileEdit() {
      uni.navigateTo({ url: "/pages/profile/profile-edit" });
    },

    goToTickets() {
      uni.switchTab({ url: "/pages/my-tickets/my-tickets" });
    },

    goToMessages() {
      uni.navigateTo({ url: "/pages/messages/messages" });
    },

    goToLegal() {
      uni.navigateTo({ url: "/pages/legal/privacy" });
    },

    editInvoice() {
      // #ifdef MP-WEIXIN
      if (wx && wx.chooseInvoiceTitle) {
        wx.chooseInvoiceTitle({
          success: (res) => {
            const title = res?.title || res?.company || "";
            if (title) {
              this.invoiceTitle = title;
              const userStore = useUserStore();
              userStore.setInvoiceTitle(title);
              uni.showToast({ title: "已同步微信发票抬头", icon: "success" });
              return;
            }
          },
          fail: () => {
            this.openInvoiceTitleModal();
          },
        });
        return;
      }
      // #endif
      this.openInvoiceTitleModal();
    },

    openInvoiceTitleModal() {
      uni.showModal({
        title: "发票抬头",
        content: "请输入发票抬头（公司或个人姓名）",
        editable: true,
        placeholderText: this.invoiceTitle || "示例：北京某某科技有限公司",
        success: (res) => {
          if (res.confirm && res.content) {
            this.invoiceTitle = res.content;
            const userStore = useUserStore();
            userStore.setInvoiceTitle(res.content);
            uni.showToast({ title: "已保存", icon: "success" });
          }
        },
      });
    },

    contactService() {
      // #ifdef MP-WEIXIN
      if (wx && wx.openCustomerServiceChat) {
        wx.openCustomerServiceChat({
          extInfo: { url: "" },
          corpId: "",
          success: () => {},
          fail: () => {
            this.openPhoneServiceModal();
          },
        });
        return;
      }
      // #endif
      this.openPhoneServiceModal();
    },

    openPhoneServiceModal() {
      uni.showModal({
        title: "客服电话",
        content: "010-88888888",
        confirmText: "拨打",
        success: (res) => {
          if (res.confirm) {
            uni.makePhoneCall({ phoneNumber: "01088888888" });
          }
        },
      });
    },

    openCityPicker() {
      this.showCityPicker = true;
    },

    closeCityPicker() {
      this.showCityPicker = false;
    },

    chooseCity(city) {
      this.currentCity = city;
      this.showCityPicker = false;
    },

    handleLogout() {
      uni.showModal({
        title: "提示",
        content: "确定要退出登录吗？",
        success: (res) => {
          if (res.confirm) {
            uni.showModal({
              title: "再次确认",
              content: "退出后需要重新登录才能继续使用全部功能，是否仍要退出？",
              confirmText: "仍要退出",
              cancelText: "再想想",
              success: (res2) => {
                if (res2.confirm) {
                  const userStore = useUserStore();
                  userStore.logout();
                  uni.reLaunch({ url: "/pages/login/login" });
                }
              },
            });
          }
        },
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.profile-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

/* 导航栏 */
.profile-navbar {
  background: $cr7-black;
  position: relative;
  z-index: 10;
}

.navbar-row {
  height: 96rpx;
  padding: 0 48rpx;
  display: flex;
  align-items: center;
  position: relative;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.city-switch {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.city-name {
  font-size: $font-xs;
  color: $text-white;
}

.city-arrow-icon {
  width: 36rpx;
  height: 36rpx;
}

.navbar-notification {
  position: relative;
}

.nav-icon {
  width: 42rpx;
  height: 42rpx;
}

.notification-dot {
  position: absolute;
  top: 2rpx;
  right: 2rpx;
  width: 14rpx;
  height: 14rpx;
  background: $cr7-red;
  border-radius: 50%;
}

.navbar-logo {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.logo-img {
  width: 156rpx;
  height: 35rpx;
}

.logo-cr7 {
  font-size: 38rpx;
  font-weight: 900;
  color: $text-white;
  letter-spacing: 2rpx;
}

.logo-life {
  font-size: 28rpx;
  font-weight: 400;
  color: $text-white;
  letter-spacing: 4rpx;
}

.profile-scroll {
  height: calc(100vh - 200rpx);
}

/* 用户信息 */
.user-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 0 32rpx;
}

.avatar-wrap {
  position: relative;
  width: 234rpx;
  height: 234rpx;
  margin-bottom: 24rpx;
}

.avatar {
  width: 234rpx;
  height: 234rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(216, 252, 15, 0.3);
}

.camera-btn {
  position: absolute;
  top: 0;
  left: 0;
  width: 56rpx;
  height: 56rpx;
  background: $cr7-dark;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-icon {
  width: 32rpx;
  height: 32rpx;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 4rpx;
}

.nickname {
  font-size: 40rpx;
  font-weight: 500;
  color: $text-white;
}

.employee-tag {
  background: rgba(216, 252, 15, 0.2);
  padding: 6rpx 24rpx;
  border-radius: 40rpx;
}

.employee-tag-text {
  font-size: $font-sm;
  color: $text-white;
}

.login-method {
  font-size: $font-xs;
  color: $text-light;
}

/* 功能列表 */
.menu-list {
  padding: 24rpx 48rpx 0;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  background: $cr7-dark;
  border-radius: 32rpx;
  padding: 28rpx 20rpx;
}

.menu-icon-wrap {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.menu-icon {
  width: 42rpx;
  height: 42rpx;
}

.menu-text {
  flex: 1;
  font-size: 26rpx;
  color: $text-white;
}

.menu-badge {
  background: $cr7-red;
  color: #fff;
  font-size: $font-footnote;
  min-width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 999rpx;
  padding: 0 10rpx;
  margin-right: 8rpx;
}

.menu-arrow {
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
  opacity: 0.3;
}

/* 退出登录 */
.logout-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 64rpx 0 40rpx;
}

.logout-icon {
  width: 42rpx;
  height: 42rpx;
}

.logout-text {
  font-size: $font-base;
  color: $cr7-red;
}

/* 底部占位 */
.bottom-spacer {
  height: 260rpx;
}

/* 城市选择弹层 */
.city-modal {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.city-panel {
  width: 100%;
  background: $cr7-dark;
  border-top-left-radius: $radius-xl;
  border-top-right-radius: $radius-xl;
  padding: 40rpx 48rpx 60rpx;
}

.city-panel-title {
  font-size: $font-lg;
  color: $text-white;
  font-weight: 600;
  margin-bottom: 32rpx;
}

.city-list {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.city-item {
  padding: 16rpx 40rpx;
  border-radius: 999rpx;
  background: $cr7-card;
  font-size: $font-sm;
  color: $text-light;

  &.active {
    background: rgba(216, 252, 15, 0.15);
    color: $cr7-gold;
    border: 2rpx solid $cr7-gold;
  }
}
</style>
