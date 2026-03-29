<template>
  <view class="tickets-page">
    <!-- 顶部标题栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-back">
          <!-- <text class="nav-back-icon">‹</text> -->
        </view>
        <text class="nav-title">我的票夹</text>
        <view class="nav-placeholder"></view>
      </view>
    </view>

    <!-- 工具栏：票码兑换 / 三方票同步 -->
    <view
      class="ticket-toolbar"
      @click.stop
      :style="{ marginTop: navBlockPx + 'px' }"
    >
      <view class="tool-item" @click="syncThirdTickets">
        <view class="tool-icon-box">
          <sx-svg name="ticket" :width="36" :height="36" color="#FFFFFF" />
        </view>
        <text class="tool-label">票码兑换</text>
      </view>
      <view class="tool-item" @click="syncThirdTickets">
        <view class="tool-icon-box">
          <sx-svg name="sync" :width="36" :height="36" color="#FFFFFF" />
        </view>
        <text class="tool-label">三方票同步</text>
      </view>
    </view>

    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>

    <template v-else>
      <!-- 空状态 -->
      <view v-if="tickets.length === 0" class="empty">
        <view class="empty-badge">
          <text class="empty-cr7">CR7</text>
        </view>
        <text class="empty-text">暂无票券，先去解锁一次传奇体验吧</text>
        <button class="btn-gold empty-btn" @click="goToBuy">立即购票</button>
      </view>

      <!-- 票券列表 -->
      <scroll-view v-else class="ticket-scroll" scroll-y>
        <view v-for="ticket in tickets" :key="ticket.id" class="ticket-card">
          <!-- 票面大图 + 状态胶囊 -->
          <view class="ticket-cover-wrap" @click="goToDetail(ticket)">
            <image
              class="ticket-cover"
              :src="ticket.eventCover || '/static/images/event-card.jpg'"
              mode="aspectFill"
            />
            <view
              class="ticket-status-pill"
              :class="getStatusPillClass(ticket.status)"
            >
              <text class="pill-text">{{ getStatusText(ticket.status) }}</text>
            </view>
          </view>

          <!-- 内容区域 -->
          <view class="ticket-body">
            <!-- 标题 + 标签 -->
            <view class="ticket-title-row">
              <text class="ticket-event-name">{{ ticket.eventName }}</text>
              <view
                class="ticket-type-tag"
                :class="ticket.isThird ? 'tag-third' : 'tag-official'"
              >
                <text
                  class="tag-text"
                  :class="
                    ticket.isThird ? 'tag-text-third' : 'tag-text-official'
                  "
                >
                  {{ ticket.isThird ? "三方票" : "官方票" }}
                </text>
              </view>
            </view>

            <!-- 信息行 -->
            <view class="ticket-info-list" @click="goToDetail(ticket)">
              <view class="info-row">
                <sx-svg
                  class="info-icon"
                  name="time"
                  :width="28"
                  :height="28"
                  color="#ADADAD"
                />
                <text class="info-text">{{ ticket.eventDate }}</text>
              </view>
              <view class="info-row">
                <sx-svg
                  class="info-icon"
                  name="location"
                  :width="28"
                  :height="28"
                  color="#ADADAD"
                />
                <text class="info-text">{{ getEventLocation(ticket) }}</text>
              </view>
              <view class="info-row">
                <sx-svg
                  class="info-icon"
                  name="ticket"
                  :width="28"
                  :height="28"
                  color="#ADADAD"
                />
                <text class="info-text">{{ ticketLineSummary(ticket) }}</text>
              </view>
            </view>

            <!-- 底部操作栏 -->
            <view class="ticket-actions">
              <view class="action-divider"></view>
              <view class="action-bar">
                <text class="action-price">￥{{ ticket.price * 0.01 }}</text>
                <view class="action-btns">
                  <button
                    v-if="showRefundButton(ticket)"
                    class="act-btn act-btn-outline"
                    :class="{
                      'act-btn-disabled':
                        !canApplyRefund(ticket) ||
                        ticket.status === 'refunding',
                    }"
                    :disabled="
                      !canApplyRefund(ticket) || ticket.status === 'refunding'
                    "
                    @click.stop="onRefundClick(ticket)"
                  >
                    {{ getRefundButtonText(ticket) }}
                  </button>
                  <button
                    class="act-btn act-btn-primary"
                    :class="{
                      'act-btn-primary-muted':
                        ticket.status === 'used' ||
                        ticket.status === 'refunded' ||
                        ticket.status === 'cancelled' ||
                        ticket.status === 'expired',
                      'act-btn-primary-disabled': ticket.status === 'refunding',
                    }"
                    :disabled="ticket.status === 'refunding'"
                    @click.stop="onPrimaryActionClick(ticket)"
                  >
                    {{ getPrimaryActionText(ticket) }}
                  </button>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="safe-bottom safe-area-bottom"></view>
      </scroll-view>
    </template>
  </view>
</template>

<script>
import { mockHomeCards } from "@/utils/mockData.js";
import createTabBarMixin from "@/mixins/tabBar.js";
import { listOrders, hideOrder } from "@/services/order.js";
import {
  loadExhibitionsMap,
  buildTicketRowFromOrder,
} from "@/utils/orderDisplay.js";

export default {
  mixins: [createTabBarMixin(1)],
  data() {
    return {
      loading: false,
      tickets: [],
      statusBarHeight: 0,
      navInnerPx: 55,
      /** 延迟展示 loading 的定时器，避免接口很快时整页闪一下 */
      _loadingDelayTimer: null,
    };
  },

  computed: {
    navBlockPx() {
      return (this.statusBarHeight || 0) + this.navInnerPx;
    },
  },

  onLoad() {
    const sys = uni.getSystemInfoSync();
    this.statusBarHeight = sys.statusBarHeight || 0;
  },

  onShow() {
    this.loadTickets();
  },

  onUnload() {
    this.clearLoadingDelayTimer();
  },

  methods: {
    clearLoadingDelayTimer() {
      if (this._loadingDelayTimer != null) {
        clearTimeout(this._loadingDelayTimer);
        this._loadingDelayTimer = null;
      }
    },

    async loadTickets() {
      const hasCachedList = this.tickets.length > 0;
      this.clearLoadingDelayTimer();
      this.loading = false;

      // 已有列表：后台刷新，不挡整页（解决每次进 tab 快请求闪屏）
      if (!hasCachedList) {
        this._loadingDelayTimer = setTimeout(() => {
          this._loadingDelayTimer = null;
          this.loading = true;
        }, 320);
      }

      try {
        const res = await listOrders({ page: 1, limit: 50 });
        const orders = Array.isArray(res?.orders) ? res.orders : [];
        orders.sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
        );
        const exMap = await loadExhibitionsMap(orders.map((o) => o.exhibit_id));
        this.tickets = orders.map((o) =>
          buildTicketRowFromOrder(o, exMap[o.exhibit_id] || null),
        );
      } catch (e) {
        console.error("listOrders", e);
        uni.showToast({ title: "订单加载失败", icon: "none" });
        this.tickets = [];
      } finally {
        this.clearLoadingDelayTimer();
        this.loading = false;
      }
    },

    ticketLineSummary(ticket) {
      const extra = ticket.refundRule || "开场前48小时可退";
      return `${ticket.ticketType} · ${extra}`;
    },

    getStatusText(status) {
      const statusMap = {
        unused: "已支付",
        used: "已完成",
        refunding: "退款中",
        refunded: "已退款",
        pending_payment: "待支付",
        cancelled: "已取消",
        expired: "已过期",
      };
      return statusMap[status] || status;
    },

    getStatusPillClass(status) {
      return {
        "pill-active": status === "unused",
        "pill-done": status === "used",
        "pill-refunding": status === "refunding",
        "pill-refunded": status === "refunded",
        "pill-pending": status === "pending_payment",
        "pill-cancelled": status === "cancelled",
        "pill-expired": status === "expired",
      };
    },

    showRefundButton(ticket) {
      return (
        ticket.canRefund &&
        (ticket.status === "unused" || ticket.status === "refunding")
      );
    },

    canApplyRefund(ticket) {
      if (!ticket.canRefund) return false;
      if (ticket.status !== "unused") return false;
      if (!ticket.eventDate) return false;
      const eventTime = new Date(ticket.eventDate.replace(/-/g, "/")).getTime();
      if (!eventTime) return false;
      const now = Date.now();
      const hoursDiff = (eventTime - now) / (1000 * 60 * 60);
      return hoursDiff > 48;
    },

    canDeleteTicket(ticket) {
      if (ticket.status === "expired" || ticket.status === "refunded")
        return true;
      return false;
    },

    getRefundButtonText(ticket) {
      if (ticket.status === "refunding") return "退款中";
      return "申请退票";
    },

    getEventLocation(ticket) {
      if (ticket.eventLocation) return ticket.eventLocation;
      const event = mockHomeCards.find((item) => item.id == ticket.eventId);
      return event && event.location ? event.location : "上海体育场";
    },

    getPrimaryActionText(ticket) {
      if (this.canDeleteTicket(ticket)) return "删除订单";
      return ticket.orderStatus === "PENDING_PAYMENT" ? "去支付" : "查看券码";
    },

    onPrimaryActionClick(ticket) {
      if (this.canDeleteTicket(ticket)) {
        // uni.showToast({ title: "暂未支持", icon: "none" });
        this.handleDelete(ticket);
        return;
      }
      this.goToDetail(ticket);
    },

    goToDetail(ticket) {
      if (this.canDeleteTicket(ticket)) {
        // uni.showToast({ title: "暂未支持", icon: "none" });
        return;
      }
      if (ticket.orderStatus === "PENDING_PAYMENT") {
        uni.navigateTo({
          url: `/pages/order-confirm/order-confirm?orderId=${encodeURIComponent(ticket.id)}`,
        });
        return;
      }
      uni.navigateTo({
        url: `/pages/ticket-detail/ticket-detail?id=${encodeURIComponent(ticket.id)}`,
      });
    },

    onRefundClick(ticket) {
      if (!this.canApplyRefund(ticket)) return;
      uni.navigateTo({
        url: `/pages/ticket-refund/ticket-refund?id=${ticket.id}`,
      });
    },

    handleDelete(ticket) {
      uni.showModal({
        title: "删除票券",
        content: "删除后将无法在票夹中看到该票券记录，确认删除？",
        success: async (res) => {
          if (!res.confirm) return;
          try {
            uni.showLoading({ title: "删除中...", mask: true });
            await hideOrder(ticket.id);
            uni.hideLoading();
            uni.showToast({ title: "已删除", icon: "success" });
            await this.loadTickets();
          } catch (e) {
            uni.hideLoading();
            uni.showToast({ title: "删除失败，请稍后重试", icon: "none" });
            console.error("hideOrder", e);
          }
        },
      });
    },

    goToBuy() {
      uni.switchTab({
        url: "/pages/index/index",
      });
    },

    goToExchange() {
      uni.navigateTo({
        url: "/pages/vote/vote",
      });
    },

    syncThirdTickets() {
      uni.navigateTo({
        url: "/pages/third-ticket-sync/third-ticket-sync",
      });
    },

    goBack() {
      uni.navigateBack({ delta: 1 });
    },
  },
};
</script>

<style lang="scss" scoped>
.tickets-page {
  min-height: 100vh;
  background: $cr7-black;
  padding-left: 32rpx;
  padding-right: 32rpx;
  display: flex;
  flex-direction: column;
}

/* ===== 加载中（占满工具栏下方剩余区域并居中） ===== */
.loading-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 400rpx;
  box-sizing: border-box;
}

.loading-text {
  font-size: 28rpx;
  color: $text-muted;
  text-align: center;
}

/* ===== 顶部标题栏 ===== */
.nav-bar {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 20;
  background: $cr7-black;
  padding-left: 32rpx;
  padding-right: 32rpx;
}

.nav-inner {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-back {
  width: 70rpx;
  height: 70rpx;
  // border-radius: 40rpx;
  // background: $cr7-dark;
  // display: flex;
  // align-items: center;
  // justify-content: center;
}

.nav-back-icon {
  font-size: 44rpx;
  color: $text-white;
  line-height: 1;
  margin-top: -6rpx;
}

.nav-placeholder {
  width: 70rpx;
  height: 70rpx;
}

/* ===== 工具栏 ===== */
.ticket-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $cr7-dark;
  border-radius: $radius-lg;
  padding: 32rpx;
  margin-top: 16rpx;
  gap: 108rpx;
  height: 123rpx;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.tool-icon-box {
  width: 62rpx;
  height: 62rpx;
  border-radius: 12rpx;
  background: $cr7-card;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-icon-text {
  font-size: 32rpx;
}

.tool-label {
  font-size: $font-base;
  color: $text-white;
  font-weight: 500;
}

/* ===== 空状态 ===== */
.empty {
  padding-top: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-badge {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: $cr7-gold;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32rpx;
}

.empty-cr7 {
  font-size: 52rpx;
  font-weight: 800;
  color: $cr7-black;
}

.empty-text {
  font-size: $font-sm;
  color: $text-light;
  margin-bottom: 32rpx;
}

.empty-btn {
  width: 360rpx;
  height: 88rpx;
  margin-top: 8rpx;
}

/* ===== 票券列表 ===== */
.ticket-scroll {
  height: calc(100vh - 260rpx);
  margin-top: 32rpx;
  margin-bottom: 100rpx;
}

.ticket-card {
  background: $cr7-dark;
  border-radius: 32rpx;
  overflow: hidden;
  margin-bottom: 32rpx;
}

/* ===== 票面大图 ===== */
.ticket-cover-wrap {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 */
  overflow: hidden;
}

.ticket-cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.ticket-status-pill {
  position: absolute;
  top: 24rpx;
  left: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 999rpx;
}

.pill-active {
  background: $cr7-gold;
}

.pill-done {
  // background: rgba(216, 252, 15, 0.4);
  background: #787878;
}

.pill-refunding {
  background: rgba(243, 156, 18, 0.6);
}

.pill-refunded {
  // background: rgba(142, 142, 142, 0.4);
  background: #787878;
}

.pill-pending {
  // background: rgba(243, 156, 18, 0.55);
  background: $cr7-gold;
}

.pill-cancelled {
  // background: rgba(120, 120, 120, 0.55);
  background: #787878;
}

.pill-expired {
  background: #787878;
}

.pill-text {
  font-size: 24rpx;
  color: #0f2316;
  font-weight: 500;
}

/* ===== 内容区域 ===== */
.ticket-body {
  padding: 30rpx 32rpx 32rpx;
}

/* 标题行 */
.ticket-title-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding-bottom: 4rpx;
}

.ticket-event-name {
  font-size: 36rpx;
  color: $text-white;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-type-tag {
  padding: 4rpx 24rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36rpx;
}

.tag-official {
  background: rgba(234, 179, 8, 0.2);
}

.tag-third {
  background: rgba(58, 97, 255, 0.2);
}

.tag-text {
  font-size: 20rpx;
  line-height: 20rpx;
  font-weight: 400;
  text-align: center;
  text-transform: uppercase;
}

.tag-text-official {
  color: #eab308;
}

.tag-text-third {
  color: #3a61ff;
}

/* 信息列表 */
.ticket-info-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 16rpx;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.info-icon {
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
}

.info-text {
  font-size: 28rpx;
  color: $text-light;
  font-weight: 500;
  line-height: 40rpx;
}

/* ===== 底部操作栏 ===== */
.ticket-actions {
  margin-top: 16rpx;
  padding-top: 16rpx;
}

.action-divider {
  height: 2rpx;
  background: $cr7-card;
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 32rpx;
}

.action-price {
  font-size: 28rpx;
  color: $cr7-gold;
  font-weight: 500;
}

.action-btns {
  display: flex;
  gap: 16rpx;
}

.act-btn {
  padding: 18rpx 34rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 500;
  line-height: normal;
  text-align: center;
}

.act-btn::after {
  border: none;
}

.act-btn-outline {
  background: transparent;
  border: 2rpx solid $cr7-gold;
  color: $text-white;
}

.act-btn-outline.act-btn-disabled {
  border-color: $cr7-border;
  color: $text-muted;
  opacity: 0.6;
}

.act-btn-primary {
  background: $cr7-gold;
  color: #0f2316;
  border: none;
}

.act-btn-primary-muted {
  background: $text-disabled;
  color: #0f2316;
}

.act-btn-primary-disabled {
  background: $btn-disabled-bg;
  color: $text-muted;
}

/* ===== 安全区域 ===== */
.safe-bottom {
  height: 80rpx;
}
</style>
