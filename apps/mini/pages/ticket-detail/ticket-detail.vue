<template>
  <view class="ticket-detail-page">
    <cr7-nav-bar title="票券详情" fallback-url="/pages/my-tickets/my-tickets" />
    <view
      v-if="pageLoading"
      class="page-state"
      :style="{ paddingTop: navInsetPx + 'px' }"
    >
      <text class="page-state-text">加载中...</text>
    </view>
    <view
      v-else-if="pageError"
      class="page-state"
      :style="{ paddingTop: navInsetPx + 'px' }"
    >
      <text class="page-state-text">{{ pageError }}</text>
    </view>
    <template v-else>
      <scroll-view class="detail-scroll" scroll-y :style="detailScrollStyle">
        <!-- 状态标签 + 票号 -->
        <view class="status-row">
          <view class="status-tag" :class="statusTagClass">
            <!-- <view class="status-dot" :class="'dot-' + ticket.status" /> -->
            <text class="status-label">{{
              getStatusText(this.redemptionStatus)
            }}</text>
          </view>
          <view class="ticket-no-wrap">
            <sx-svg name="ticket" :width="24" :height="24" color="#ADADAD" />
            <text class="ticket-no"
              >票号: {{ redemptionCode || ticket.id }}</text
            >
          </view>
        </view>

        <!-- 活动主卡片 -->
        <view class="event-main-card">
          <view class="event-card-inner card-dark">
            <!-- <image
              :src="ticket.eventCover || '/static/images/event-card.jpg'"
              mode="aspectFill"
              class="event-cover"
            /> -->
            <view class="event-info-wrap">
              <text class="event-title">{{ ticket.eventName }}</text>
              <view class="event-meta-item">
                <sx-svg
                  class="meta-icon"
                  name="time"
                  :width="28"
                  :height="28"
                  color="#ADADAD"
                />
                <text class="meta-text">{{ validityText }}</text>
              </view>
              <view class="event-meta-item">
                <sx-svg
                  class="meta-icon"
                  name="location"
                  :width="28"
                  :height="28"
                  color="#ADADAD"
                />
                <text class="meta-text">{{ ticket.eventLocation }}</text>
              </view>
              <view
                v-if="showDetailSessionSlots"
                class="session-slot-row session-slot-row--readonly"
              >
                <view
                  class="session-slot-pill"
                  :class="{ active: detailSessionSlot === 'AM' }"
                >
                  <text class="session-slot-text">上午场</text>
                </view>
                <view
                  class="session-slot-pill"
                  :class="{ active: detailSessionSlot === 'PM' }"
                >
                  <text class="session-slot-text">下午场</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 电子票二维码 -->
        <view v-if="showQrBlock" class="qr-section">
          <view
            class="qr-card"
            :style="{ backgroundColor: qrcodeStyle.bgColor }"
          >
            <text
              class="qr-card-title"
              :style="{ color: qrcodeStyle.textColor }"
              >{{ qrcodeStyle.name }}</text
            >
            <text class="qr-title" :style="{ color: qrcodeStyle.textColor }"
              >电子票二维码</text
            >
            <view class="qr-code-wrap">
              <l-qrcode
                v-if="ticketQrPayload"
                class="qr-code-img"
                :value="ticketQrPayload"
                size="310rpx"
                bgColor="#ffffff"
                :marginSize="1"
              />
              <view v-else class="qr-code-placeholder" />
            </view>
            <text class="qr-id" :style="{ color: qrcodeStyle.bottomTextColor }"
              >ID: {{ formatTicketId(ticket.id) }}</text
            >
            <text
              class="qr-hint"
              :style="{ color: qrcodeStyle.bottomTextColor }"
              >使用时请向工作人员出示此码</text
            >
          </view>
        </view>
        <view v-else class="qr-section">
          <view class="qr-card qr-card-muted">
            <text class="qr-hint"
              >支付完成后可在此查看入场凭证（二维码待核销接口对接）</text
            >
          </view>
        </view>

        <!-- 票务详情列表 -->
        <view class="detail-list card-dark">
          <view class="detail-row">
            <text class="detail-label">票种</text>
            <text class="detail-value">{{ ticket.ticketType }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">数量</text>
            <text class="detail-value">{{ ticket.quantity }} 张</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">购买时间</text>
            <text class="detail-value">{{ ticket.purchaseTime }}</text>
          </view>
          <view class="detail-row detail-row-last">
            <text class="detail-label">订单总额</text>
            <text class="detail-value price"
              >¥ {{ formatPrice(ticket.price * 0.01) }}</text
            >
          </view>
        </view>

        <!-- 使用说明 -->
        <view class="instructions-section">
          <view class="instructions-header">
            <text class="info-icon">ⓘ</text>
            <text class="instructions-title">使用说明</text>
          </view>
          <view class="instructions-card card-dark">
            <text
              v-for="(item, index) in noticeList"
              :key="index"
              class="instruction-item"
              >{{ item }}</text
            >
          </view>
        </view>

        <view class="scroll-bottom-space" />
      </scroll-view>

      <!-- 底部：待支付 -->
      <view
        v-if="ticket.orderStatus === 'PENDING_PAYMENT'"
        class="bottom-bar bottom-bar-pay safe-area-bottom"
      >
        <view class="bottom-bar-inner bottom-bar-inner-single">
          <button class="action-btn primary-pay-btn" @click="goPay">
            前往支付
          </button>
        </view>
      </view>

      <!-- 底部：待使用 / 已使用 / 过期等 -->
      <view
        v-else-if="showDetailActionsBar"
        class="bottom-bar safe-area-bottom"
      >
        <view class="bottom-bar-inner">
          <button class="action-btn outline-btn" @click="handleLeftAction">
            {{ detailLeftLabel }}
          </button>
          <button
            class="action-btn outline-btn"
            :class="{ 'outline-btn-disabled': invoiceDisabled }"
            :disabled="invoiceDisabled"
            @click="handleInvoice"
          >
            开具发票
          </button>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import { getOrderDetail, cancelOrder } from "@/services/order.js";
import { getOrderRedemption } from "@/services/redeem.js";
import { applyOrderInvoice } from "@/services/invoice.js";
import request from "@/utils/request.js";
import { buildTicketDetailFromOrder } from "@/utils/orderDisplay.js";
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { useUserStore } from "@/stores/user";
import dayjs from "dayjs";

const ticketColorConfig = [
  {
    name: "早鸟票",
    bgColor: "#8A38F5",
    textColor: "#FFFFFF",
    bottomTextColor: "rgba(255, 255, 255, 0.6)",
  },
  {
    name: "单人票",
    bgColor: "#D8FC0F",
    textColor: "#090A07",
    bottomTextColor: "#787878",
  },
  {
    name: "双人票",
    bgColor: "#EAB308",
    textColor: "#090A07",
    bottomTextColor: "#787878",
  },
  {
    name: "家庭票",
    bgColor: "#04B155",
    textColor: "#FFFFFF",
    bottomTextColor: "rgba(255, 255, 255, 0.6)",
  },
];

const NOTICE_LIST = [
  "1. 入场时请向工作人员出示此二维码，核销后即可入场；",
  "2. 每张票券仅可核销一次，截图或复制无效；",
  "3. 建议提前30分钟到达现场，以免错过参观时段；",
  "4. 入场需携带本人身份证件，部分场次可能进行安检。",
];

export default {
  components: {
    Cr7NavBar,
  },

  data() {
    return {
      ticketId: "",
      ticket: {},
      validityText: "",
      redemption: null,
      redemptionError: "",
      noticeList: NOTICE_LIST,
      pageLoading: true,
      pageError: "",
      navInsetPx: 0,
      qrcodeStyle: null,
      invoiceSubmitting: false,
    };
  },

  computed: {
    detailScrollStyle() {
      return {
        paddingTop: `${this.navInsetPx}px`,
        paddingBottom: this.detailScrollPadding,
      };
    },
    showQrBlock() {
      return this.ticket.orderStatus === "PAID";
    },
    /** 底部双按钮仅跟随核销状态：待使用/已使用 */
    showDetailActionsBar() {
      if (this.ticket.orderStatus === "PENDING_PAYMENT") return false;
      return ["UNREDEEMED", "REDEEMED"].includes(this.redemptionStatus);
    },
    redemptionStatus() {
      return this.redemption?.status || "";
    },
    statusTagClass() {
      if (this.redemptionStatus === "REDEEMED") return "tag-used";
      if (this.redemptionStatus === "UNREDEEMED") return "tag-unused";
      return `tag-${this.ticket.status || ""}`;
    },
    /** 待使用可申请退票，已使用显示删除订单 */
    detailLeftIsRefund() {
      return this.redemptionStatus === "UNREDEEMED";
    },
    detailLeftLabel() {
      return this.detailLeftIsRefund ? "申请退票" : "删除订单";
    },
    /** 仅已使用可开具发票 */
    invoiceDisabled() {
      return this.redemptionStatus !== "REDEEMED";
    },
    redemptionCode() {
      return this.redemption?.code || "";
    },
    ticketQrPayload() {
      if (!this.redemptionCode || !this.ticket?.eventId) return "";
      return `CR7|eid=${this.ticket.eventId}|code=${this.redemptionCode}`;
    },
    redemptionValidityText() {
      const from = this.redemption?.valid_from;
      const until = this.redemption?.valid_until;
      if (!from || !until) return "";
      return `${this.formatDateTime(from)} - ${this.formatDateTime(until)}`;
    },
    redemptionStatusText() {
      if (this.redemptionStatus === "REDEEMED") return "已核销";
      if (this.redemptionStatus === "UNREDEEMED") return "待核销";
      return "";
    },
    detailScrollPadding() {
      if (this.ticket.orderStatus === "PENDING_PAYMENT") return "180rpx";
      if (this.showDetailActionsBar) return "180rpx";
      return "40rpx";
    },
    /** 已支付且能识别半日场次时展示（与购票页 Figma 一致） */
    showDetailSessionSlots() {
      if (this.ticket.orderStatus !== "PAID") return false;
      if (!this.redemption?.session) return false;
      return this.detailSessionSlot === "AM" || this.detailSessionSlot === "PM";
    },
    /** 根据订单场次 id（-AM/-PM）或开场时间推断 */
    detailSessionSlot() {
      const sid = this.redemption?.session?.id || "";
      if (String(sid).endsWith("-PM")) return "PM";
      if (String(sid).endsWith("-AM")) return "AM";
      const open = this.redemption?.session?.opening_time || "";
      const m = String(open).match(/(\d{1,2}):(\d{2})/);
      if (m) {
        const h = parseInt(m[1], 10);
        if (!Number.isNaN(h)) return h >= 13 ? "PM" : "AM";
      }
      return "";
    },
  },

  onLoad(options) {
    this.navInsetPx = getNavBarInsetPx();
    this.ticketId = options.id;
    this.loadTicketDetail();
  },

  methods: {
    async loadTicketDetail() {
      this.pageLoading = true;
      this.pageError = "";
      this.redemption = null;
      this.redemptionError = "";
      try {
        const order = await getOrderDetail(this.ticketId);
        let exhibition = null;
        try {
          exhibition = await request.get(
            `/exhibition/${encodeURIComponent(order.exhibit_id)}`,
          );
        } catch (e) {
          exhibition = null;
        }
        this.ticket = buildTicketDetailFromOrder(order, exhibition);
        await this.loadRedemption(order);
        this.pageLoading = false;
      } catch (e) {
        this.pageLoading = false;
        this.pageError = "票券不存在或已失效";
        console.error("ticket detail", e);
      }
    },

    async loadRedemption(order) {
      if (!order || order.status !== "PAID") return;
      try {
        this.redemption = await getOrderRedemption(order.id);

        const openingTime = dayjs(
          this.redemption.session?.session_date +
            " " +
            this.redemption.session?.opening_time,
        ).format("HH:mm");
        const closingTime = dayjs(
          this.redemption.session?.session_date +
            " " +
            this.redemption.session?.closing_time,
        ).format("HH:mm");
        this.validityText = `${this.redemption.session?.session_date} ${openingTime} ~ ${closingTime}`;

        const categoryName = this.redemption?.items[0]?.category_name;
        console.log("categoryName", categoryName);
        if (categoryName) {
          this.qrcodeStyle =
            ticketColorConfig.find((item) => item.name === categoryName) ??
            ticketColorConfig[0];
        }
      } catch (e) {
        if (e?.statusCode === 410) {
          this.redemptionError = "该订单暂未生成核销码，请稍后刷新";
          return;
        }
        if (e?.statusCode === 404) {
          this.redemptionError = "未查询到核销信息";
          return;
        }
        this.redemptionError = "核销信息加载失败";
        console.error("loadRedemption", e);
      }
    },

    goPay() {
      uni.navigateTo({
        url: `/pages/order-confirm/order-confirm?orderId=${encodeURIComponent(this.ticketId)}`,
      });
    },

    getStatusText(status) {
      const statusMap = {
        unused: "待使用",
        used: "已使用",
        refunding: "退款中",
        refunded: "已退款",
        pending_payment: "待支付",
        cancelled: "已取消",
        expired: "已过期",
        UNREDEEMED: "待使用",
        REDEEMED: "已使用",
      };
      return statusMap[status] || status;
    },

    formatTicketId(id) {
      if (!id) return "";
      const raw = id.replace(/\D/g, "");
      return raw.replace(/(.{4})/g, "$1 ").trim();
    },

    formatRedeemCode(code) {
      if (!code) return "";
      return String(code)
        .replace(/(.{4})/g, "$1 ")
        .trim();
    },

    formatDateTime(value) {
      if (!value) return "";
      const d = new Date(String(value).replace(/-/g, "/"));
      if (Number.isNaN(d.getTime())) return String(value);
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${yy}-${mm}-${dd} ${hh}:${mi}`;
    },

    formatPrice(price) {
      if (!price && price !== 0) return "0.00";
      return Number(price)
        .toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    handleLeftAction() {
      if (this.detailLeftIsRefund) {
        this.handleRefund();
        return;
      }
      this.handleDeleteOrder();
    },

    handleRefund() {
      uni.navigateTo({
        url: "/pages/ticket-refund/ticket-refund?id=" + this.ticketId,
      });
    },

    validateEmail(email) {
      if (!email) return false;
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return pattern.test(email);
    },

    async chooseWechatInvoiceTitle() {
      // #ifdef MP-WEIXIN
      if (typeof wx !== "undefined" && wx.chooseInvoiceTitle) {
        return new Promise((resolve) => {
          wx.chooseInvoiceTitle({
            success: (res) => {
              const invoiceTitle = (res?.title || res?.company || "").trim();
              const taxNo = (res?.taxNumber || "").trim();
              resolve({ invoiceTitle, taxNo });
            },
            fail: (err) => {
              const errMsg = String(err?.errMsg || "");
              const isCancel = errMsg.includes("cancel");
              if (!isCancel) {
                uni.showToast({ title: "获取微信发票抬头失败", icon: "none" });
              }
              resolve(null);
            },
          });
        });
      }
      // #endif
      return null;
    },

    async promptInvoiceTitle(defaultTitle = "") {
      const titleRes = await new Promise((resolve) => {
        uni.showModal({
          title: "发票抬头",
          editable: true,
          content: defaultTitle,
          placeholderText: "示例：北京某某科技有限公司",
          success: (res) => resolve(res),
          fail: () => resolve({ confirm: false }),
        });
      });
      if (!titleRes.confirm) return "";
      return (titleRes.content || "").trim();
    },

    async collectInvoicePayload() {
      const userStore = useUserStore();
      const profile = userStore.profile || {};
      const profileExtra =
        profile.profile && typeof profile.profile === "object"
          ? profile.profile
          : {};
      const storedTitle = userStore.invoiceTitle || "";
      const defaultEmail = profile.email || profileExtra.email || "";

      const wechatInvoice = await this.chooseWechatInvoiceTitle();
      let invoiceTitle = wechatInvoice?.invoiceTitle || "";
      const taxNo = wechatInvoice?.taxNo || "";

      if (!invoiceTitle) {
        invoiceTitle = await this.promptInvoiceTitle(storedTitle);
      }
      if (!invoiceTitle) {
        uni.showToast({ title: "请填写发票抬头", icon: "none" });
        return null;
      }

      const emailRes = await new Promise((resolve) => {
        uni.showModal({
          title: "接收邮箱",
          editable: true,
          content: defaultEmail,
          placeholderText: "请输入常用邮箱地址",
          success: (res) => resolve(res),
          fail: () => resolve({ confirm: false }),
        });
      });
      if (!emailRes.confirm) return null;
      const email = (emailRes.content || "").trim();
      if (!this.validateEmail(email)) {
        uni.showToast({ title: "邮箱格式不正确", icon: "none" });
        return null;
      }

      if (invoiceTitle !== storedTitle) {
        userStore.setInvoiceTitle(invoiceTitle);
      }

      const payload = {
        invoice_title: invoiceTitle,
        email,
      };
      if (taxNo) {
        payload.tax_no = taxNo;
      }
      return payload;
    },

    async handleInvoice() {
      if (this.invoiceDisabled) return;
      if (this.invoiceSubmitting) return;
      const payload = await this.collectInvoicePayload();
      if (!payload) return;
      this.invoiceSubmitting = true;
      try {
        uni.showLoading({ title: "开具中...", mask: true });
        await applyOrderInvoice(this.ticketId, payload);
        uni.hideLoading();
        uni.showToast({ title: "发票申请成功", icon: "success" });
      } catch (e) {
        uni.hideLoading();
        const statusCode = e?.statusCode;
        let title = e?.data?.message || "发票申请失败";
        if (statusCode === 400) title = "参数错误，请检查抬头和邮箱";
        if (statusCode === 401) title = "登录已过期，请重新登录";
        if (statusCode === 404) title = "订单不存在或无权限开票";
        if (statusCode === 409) title = "仅已支付订单支持申请发票";
        if (statusCode === 502) title = "开票平台繁忙，请稍后重试";
        uni.showToast({ title, icon: "none" });
      } finally {
        this.invoiceSubmitting = false;
      }
    },

    handleDeleteOrder() {
      uni.showModal({
        title: "取消订单",
        content: "确认取消该订单？取消后将释放占用库存。",
        success: async (res) => {
          if (!res.confirm) return;
          try {
            uni.showLoading({ title: "处理中...", mask: true });
            await cancelOrder(this.ticketId);
            uni.hideLoading();
            uni.showToast({ title: "已取消", icon: "success" });
            setTimeout(() => {
              uni.navigateBack();
            }, 800);
          } catch (e) {
            uni.hideLoading();
            const msg = (e && e.data && e.data.message) || "当前订单无法取消";
            uni.showToast({ title: msg, icon: "none" });
          }
        },
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.ticket-detail-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.detail-scroll {
  height: 100vh;
  box-sizing: border-box;
}

/* ===== 状态标签 + 票号 ===== */
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 30rpx 0;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 34rpx;
  height: 62rpx;
  border-radius: 999rpx;
}

.tag-unused {
  background: #d8fb0e33;
  border: 2rpx solid #d8fb0e4d;
}

.tag-used {
  background: #d8fb0e66;
  // border: 2rpx solid #d8fc0f;
}

.tag-refunding {
  background: rgba(243, 156, 18, 0.2);
  border: 2rpx solid rgba(243, 156, 18, 0.3);
}

.tag-refunded {
  background: rgba(201, 56, 56, 0.2);
  border: 2rpx solid rgba(201, 56, 56, 0.3);
}

.status-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.dot-unused {
  background: $cr7-gold;
}
.dot-used {
  background: $cr7-success;
}
.dot-refunding {
  background: $cr7-warning;
}
.dot-refunded {
  background: $cr7-red;
}

.status-label {
  font-size: 28rpx;
  font-weight: 500;
}

.tag-unused .status-label {
  color: #d8fb0e;
}
.tag-used .status-label {
  color: #0f2316;
}
.tag-refunding .status-label {
  color: $cr7-warning;
}
.tag-refunded .status-label {
  color: $cr7-red;
}

.ticket-no-wrap {
  display: flex;
  align-items: center;
}

.ticket-no {
  font-size: 24rpx;
  color: $text-disabled;
  margin-left: 10rpx;
  //养起来居中显示
  margin-top: 4rpx;
}

/* ===== 活动主卡片 ===== */
.event-main-card {
  padding: 30rpx;
}

.event-card-inner {
  overflow: hidden;
}

.event-cover {
  width: 100%;
  height: 291rpx;
}

.event-info-wrap {
  // padding: 38rpx;
  padding: 38rpx 38rpx 15rpx 38rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.event-title {
  font-size: 34rpx;
  color: $text-white;
  font-weight: 500;
  letter-spacing: -1rpx;
  line-height: 1.6;
}

.event-meta-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.meta-icon {
  flex-shrink: 0;
}

.meta-text {
  font-size: 28rpx;
  color: $text-light;
  line-height: 1.4;
}

.session-slot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 8rpx;
  width: 100%;
}

.session-slot-row--readonly {
  pointer-events: none;
}

.session-slot-pill {
  flex: 1;
  min-width: 0;
  height: 64rpx;
  border-radius: 21rpx;
  background: $cr7-dark;
  border: 2rpx solid transparent;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.session-slot-text {
  font-size: 22rpx;
  line-height: 42rpx;
  color: $text-white;
  font-weight: 400;
}

.session-slot-pill.active {
  border-color: $cr7-gold;
}

.session-slot-pill.active .session-slot-text {
  color: $cr7-gold;
}

/* ===== 电子票二维码 ===== */
.qr-section {
  padding: 0 30rpx 46rpx;
}

.qr-card {
  background: $cr7-card;
  border-radius: $radius-xl;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  // padding: 62rpx;
  width: 686rpx;
  height: 686rpx;
}

.qr-card-title {
  font-size: 60rpx;
  color: $text-white;
  font-weight: 500;
  line-height: 60rpx;
}

.qr-title {
  font-size: 24rpx;
  color: $text-white;
  font-weight: 500;
  line-height: 53.85rpx;
  margin-bottom: 20rpx;
}

.qr-code-wrap {
  background: #ffffff;
  border-radius: 30rpx;
  width: 370rpx;
  height: 370rpx;
  padding: 30rpx;
  box-shadow: inset 0 4rpx 8rpx rgba(0, 0, 0, 0.05);
}

.qr-code-placeholder {
  width: 370rpx;
  height: 370rpx;
  background: #e2e8f0;
}

.qr-code-img {
  width: 370rpx;
  height: 370rpx;
}

.qr-id {
  font-size: 24rpx;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 24rpx;
}

.qr-hint {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8rpx;
}

.qr-validity {
  font-size: 20rpx;
  color: $text-muted;
  margin-top: 8rpx;
}

.qr-error {
  font-size: 20rpx;
  color: $cr7-warning;
  margin-top: 8rpx;
}

/* ===== 票务详情列表 ===== */
.detail-list {
  margin: 0 30rpx;
  padding: 30rpx;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(42, 42, 42, 0.6);
}

.detail-row-last {
  border-bottom: none;
}

.detail-label {
  font-size: $font-base;
  color: $text-light;
  font-weight: 500;
}

.detail-value {
  font-size: $font-base;
  color: $text-white;
  font-weight: 500;
}

.detail-value.price {
  color: $cr7-gold;
  font-weight: 700;
}

/* ===== 使用说明 ===== */
.instructions-section {
  padding: 46rpx 30rpx;
}

.instructions-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.info-icon {
  font-size: 28rpx;
  color: $text-white;
}

.instructions-title {
  font-size: $font-base;
  color: $text-white;
  font-weight: 500;
}

.instructions-card {
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.instruction-item {
  font-size: 24rpx;
  color: $text-light;
  line-height: 1.8;
}

.scroll-bottom-space {
  height: 40rpx;
}

/* ===== 底部操作栏 ===== */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: $cr7-dark;
  border-top: 1rpx solid $cr7-border;
  backdrop-filter: blur(12px);
  padding: 16rpx 30rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.bottom-bar-inner {
  display: flex;
  gap: 30rpx;
  align-items: center;
}

.action-btn {
  flex: 1;
  height: 98rpx;
  border-radius: 999rpx;
  font-size: $font-base;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: normal;
}

.outline-btn {
  background: transparent;
  border: 2rpx solid $cr7-gold;
  color: $text-white;
}

.outline-btn::after {
  border: none;
}

.outline-btn-disabled,
.outline-btn[disabled] {
  opacity: 0.42;
  border-color: rgba(216, 252, 15, 0.28);
  color: $text-muted;
}

.page-state {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}

.page-state-text {
  font-size: 28rpx;
  color: $text-muted;
}

.tag-pending_payment {
  background: rgba(243, 156, 18, 0.2);
  border: 2rpx solid rgba(243, 156, 18, 0.35);
}

.dot-pending_payment {
  background: $cr7-warning;
}

.tag-pending_payment .status-label {
  color: $cr7-warning;
}

.tag-cancelled {
  background: rgba(120, 120, 120, 0.25);
  border: 2rpx solid rgba(160, 160, 160, 0.4);
}

.dot-cancelled {
  background: #9e9e9e;
}

.tag-cancelled .status-label {
  color: #bdbdbd;
}

.tag-expired {
  background: rgba(90, 90, 90, 0.3);
  border: 2rpx solid rgba(110, 110, 110, 0.45);
}

.dot-expired {
  background: #757575;
}

.tag-expired .status-label {
  color: #9e9e9e;
}

.qr-card-muted {
  padding: 40rpx 32rpx;
  align-items: flex-start;
}

.qr-card-muted .qr-hint {
  text-align: left;
  line-height: 1.6;
  margin-top: 0;
}

.bottom-bar-inner-single {
  width: 100%;
}

.primary-pay-btn {
  flex: 1;
  background: $cr7-gold;
  color: $cr7-black;
  border: none;
  font-weight: 700;
}

.primary-pay-btn::after {
  border: none;
}
</style>
