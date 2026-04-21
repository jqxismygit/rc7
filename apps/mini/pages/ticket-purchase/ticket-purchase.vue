<template>
  <view class="purchase-page">
    <cr7-nav-bar title="马上购票" />

    <scroll-view
      class="purchase-scroll"
      scroll-y
      :style="{ paddingTop: navInsetPx + 'px' }"
    >
      <!-- 背景大图区域 -->
      <view class="hero-section">
        <image class="hero-bg" :src="heroCover" mode="aspectFill" />
        <view class="hero-gradient"></view>

        <!-- 标题/副标题叠加在图片底部（首页传入 ticketSection 时使用真实文案） -->
        <view class="hero-bottom">
          <text class="hero-title">{{ heroTitle }}</text>
          <text class="hero-sub">{{ heroSub }}</text>
        </view>
      </view>

      <!-- 信息区域 -->
      <view class="info-section">
        <view class="info-row info-row-time">
          <view style="margin-top: 4px">
            <sx-svg
              class="info-icon"
              name="time"
              :width="24"
              :height="24"
              color="#D8FC0F"
            />
          </view>
          <view class="info-text-col">
            <text class="info-text">{{ infoTimePrimary }}</text>
            <text v-if="infoTimeSecondary" class="info-text info-text-indent">{{
              infoTimeSecondary
            }}</text>
          </view>
        </view>
        <view class="info-row">
          <sx-svg
            class="info-icon"
            name="location"
            :width="24"
            :height="24"
            color="#D8FC0F"
          />
          <text class="info-text">{{ infoMuseumLocation }}</text>
        </view>
        <view class="info-row">
          <sx-svg
            class="info-icon"
            name="phone"
            :width="24"
            :height="24"
            color="#D8FC0F"
          />
          <text class="info-text">{{ contactPhone }}</text>
        </view>
      </view>

      <!-- 描述卡片 -->
      <view class="desc-card">
        <view class="desc-card-bg"></view>
        <view class="desc-card-content">
          <text class="desc-main"
            >亚洲史上首个 CR7® LIFE 博物馆落户上海！2025年 7
            月博物馆于上海开幕。</text
          >
          <text class="desc-sub"
            >博物馆内球迷可以近距离看到传奇球员C罗的冠军奖杯...</text
          >
          <text class="desc-link">查看更多</text>
        </view>
      </view>

      <!-- 选择票种标题 + 日期 chips -->
      <view class="ticket-section">
        <text class="section-title">选择票种</text>
        <view class="date-chips">
          <block v-for="chip in dateChips" :key="chip.key">
            <!-- 所有日期：使用原生日期选择器 -->
            <picker
              v-if="chip.key === 'all'"
              mode="date"
              @change="onAllDateChange"
            >
              <view
                class="date-chip"
                :class="[
                  chip.wide ? 'date-chip-wide' : '',
                  activeDateKey === chip.key ? 'active' : '',
                ]"
              >
                <view
                  v-if="showCloseForChip(chip)"
                  class="date-chip-close"
                  @click.stop="clearDateSelection"
                >
                  <sx-svg
                    name="close"
                    :width="14"
                    :height="14"
                    color="#090a07"
                  />
                </view>
                <sx-svg
                  v-if="chip.icon"
                  class="chip-icon"
                  name="date-range"
                  :width="24"
                  :height="24"
                  :color="
                    chip.key === 'all' && activeDateKey === 'all'
                      ? '#D8FC0F'
                      : '#FFFFFF'
                  "
                />
                <text class="chip-main">{{ chip.main }}</text>
                <text v-if="chip.sub" class="chip-sub">{{ chip.sub }}</text>
              </view>
            </picker>

            <!-- 其他日期：普通 chip 点击切换 -->
            <view
              v-else
              class="date-chip"
              :class="[
                chip.wide ? 'date-chip-wide' : '',
                chip.disabled ? 'disabled' : '',
                activeDateKey === chip.key ? 'active' : '',
              ]"
              @click="onChipClick(chip)"
            >
              <view
                v-if="showCloseForChip(chip)"
                class="date-chip-close"
                @click.stop="clearDateSelection"
              >
                <sx-svg name="close" :width="14" :height="14" color="#090a07" />
              </view>
              <sx-svg
                v-if="chip.icon"
                class="chip-icon"
                name="date-range"
                :width="24"
                :height="24"
                :color="
                  chip.key === 'all' && activeDateKey === 'all'
                    ? '#D8FC0F'
                    : '#FFFFFF'
                "
              />
              <text class="chip-main">{{ chip.main }}</text>
              <text v-if="chip.sub" class="chip-sub">{{ chip.sub }}</text>
            </view>
          </block>
        </view>

        <!-- 上午场 / 下午场（与 Figma 一致：分日场时展示，默认上午场） -->
        <view v-if="halfDaySessionsEnabled" class="session-slot-row">
          <view
            class="session-slot-pill"
            :class="{
              active: sessionSlot === 'AM',
              disabled: !sessionSlotAvailable('AM'),
            }"
            @click="onSessionSlotClick('AM')"
          >
            <text class="session-slot-text">上午场</text>
          </view>
          <view
            class="session-slot-pill"
            :class="{
              active: sessionSlot === 'PM',
              disabled: !sessionSlotAvailable('PM'),
            }"
            @click="onSessionSlotClick('PM')"
          >
            <text class="session-slot-text">下午场</text>
          </view>
        </view>
      </view>

      <!-- 票种列表 -->
      <view class="ticket-list">
        <view
          v-for="ticket in ticketTypes"
          :key="ticket.id"
          class="ticket-card"
          :class="{ active: selectedTicket && selectedTicket.id === ticket.id }"
          @click="selectTicket(ticket)"
        >
          <!-- 限量 tag 绝对定位右上角 -->
          <view v-if="ticket.tag" class="ticket-tag-badge">
            <text class="ticket-tag-text">{{ ticket.tag }}</text>
          </view>

          <view class="ticket-card-inner">
            <view class="ticket-left">
              <text class="ticket-name">{{ ticket.name }}</text>
              <text class="ticket-desc">{{ ticket.description }}</text>
            </view>
            <view class="ticket-right">
              <text
                v-if="ticket.originalPrice > ticket.price"
                class="ticket-price-origin"
                >￥{{ ticket.originalPrice * 0.01 }}</text
              >
              <text
                class="ticket-price-now"
                :class="{ 'price-gold': ticket.originalPrice > ticket.price }"
                >¥{{ ticket.price * 0.01 }}</text
              >
            </view>
          </view>
        </view>
      </view>

      <!-- 选择张数 -->
      <view class="quantity-section">
        <text class="section-title quantity-section__title">选择张数</text>
        <view class="quantity-controls">
          <view
            class="quantity-btn quantity-btn-minus"
            :class="{ disabled: quantity <= 1 }"
            @click="decreaseQuantity"
          >
            <text class="quantity-btn-icon">−</text>
          </view>
          <text class="quantity-value">{{ quantity }}</text>
          <view
            class="quantity-btn quantity-btn-plus"
            :class="{ disabled: quantity >= maxSelectableQuantity }"
            @click="increaseQuantity"
          >
            <text class="quantity-btn-icon plus">+</text>
          </view>
        </view>
      </view>

      <!-- 购票须知入口 -->
      <!-- <view class="notice-entry">
        <text class="notice-icon">ⓘ</text>
        <text class="notice-text">购票须知</text>
      </view> -->

      <!-- 底部占位 -->
      <view class="safe-area-height-with-bottom-bar"></view>
    </scroll-view>

    <!-- 底部总额 + 立即购买（参考订单确认页样式） -->
    <view class="purchase-footer safe-area-bottom">
      <view class="purchase-footer-inner">
        <view class="footer-total">
          <text class="total-label">总额</text>
          <text class="total-value">¥{{ totalPrice * 0.01 }}</text>
        </view>
        <view class="purchase-bottom-bar">
          <wechat-phone-auth-button
            custom-class="btn-gold pay-btn"
            :disabled="!selectedTicket"
            @authorized-click="handlePayButtonClick"
          >
            立即支付
          </wechat-phone-auth-button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { mockTicketTypes, mockHomeCards } from "@/utils/mockData.js";
import { HOME_TICKET_SECTION_EVENT } from "@/utils/eventBus.js";
import {
  formatExhibitionDateRangeLine,
  formatOpenHoursLine,
} from "@/utils/ticketEventDisplay.js";
import { createOrder, ORDER_CONFIRM_CONTEXT_KEY } from "@/services/order.js";
import persistStorage from "@/utils/persistStorage.js";
import request from "@/utils/request.js";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import WechatPhoneAuthButton from "@/components/wechat-phone-auth-button/wechat-phone-auth-button.vue";
import dayjs from "dayjs";

/** 单次订单最多购票张数 */
const MAX_TICKETS_PER_ORDER = 6;

export default {
  components: {
    Cr7NavBar,
    WechatPhoneAuthButton,
  },

  data() {
    return {
      navInsetPx: 0,
      /** 首页 setStorage 传入的 { ticketEvent, ticketTypes } */
      homeTicketSection: null,
      eventId: "",
      eventName: "",
      eventDate: "",
      museumLocation: "上海市黄浦区王府井大街123号",
      ticketTypes: [],
      selectedTicket: null,
      selectedDate: "",
      activeDateKey: "today",
      allDateLabel: "",
      quantity: 1,
      /** 与首页 loadHomeTicketSection 返回的 sessionId 一致，用于创建订单 */
      sessionId: "",
      sessionOptions: [],
      /** 上午场 AM / 下午场 PM */
      sessionSlot: "AM",
      /** 按场次 id 缓存票种列表，切换上/下午不重复请求 */
      ticketTypesCache: {},
    };
  },

  computed: {
    /** 接口是否返回半日场次（id 带 -AM / -PM） */
    halfDaySessionsEnabled() {
      return (this.sessionOptions || []).some(
        (s) => s?.id && /-(?:AM|PM)$/.test(String(s.id)),
      );
    },
    heroCover() {
      return (
        this.homeTicketSection?.ticketEvent?.cover ||
        "/static/images/event-card.jpg"
      );
    },
    heroTitle() {
      return (
        this.homeTicketSection?.ticketEvent?.title ||
        "C罗博物馆 • 上海博物馆门票"
      );
    },
    heroSub() {
      if (this.homeTicketSection?.ticketEvent) {
        return "亚洲首个 CR7® LIFE 沉浸式博物馆";
      }
      return "亚洲首个CR7@LIFE 沉浸式博物馆";
    },
    infoTimePrimary() {
      const ev = this.homeTicketSection?.ticketEvent;
      if (ev?.start_date && ev?.end_date) {
        return formatExhibitionDateRangeLine(ev) || "—";
      }
      if (ev) return "—";
      return "2026.05.01-12.31";
    },
    infoTimeSecondary() {
      const ev = this.homeTicketSection?.ticketEvent;
      if (ev) {
        const line = formatOpenHoursLine(ev);
        return line || "";
      }
      return "10:00 AM - 22:00 PM(最晚入场21:00)";
    },
    infoMuseumLocation() {
      if (this.homeTicketSection?.ticketEvent) {
        return (
          this.homeTicketSection.ticketEvent.location ||
          "上海市黄浦区王府井大街123号"
        );
      }
      return this.museumLocation;
    },
    contactPhone() {
      const p = this.homeTicketSection?.ticketEvent?.contact_phone;
      if (this.homeTicketSection?.ticketEvent) {
        return p || "021-8888888";
      }
      return "021-8888888";
    },

    totalPrice() {
      if (!this.selectedTicket) return 0;
      return this.selectedTicket.price * this.quantity;
    },

    /** 张数上限：取库存与业务上限的较小值；未选票种时仍受业务上限约束 */
    maxSelectableQuantity() {
      if (!this.selectedTicket) return MAX_TICKETS_PER_ORDER;
      const stock = Math.max(0, Number(this.selectedTicket.stock) || 0);
      return Math.min(MAX_TICKETS_PER_ORDER, stock || 1);
    },

    /** 与 initDateSelection 一致：默认落到最近可买日期 */
    defaultDateChipKey() {
      const selection = this.getNearestAvailableSelection();
      return selection?.activeKey || "today";
    },

    dateChips() {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(today.getDate() + 2);

      const formatMonth = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
      const todayDate = this.formatDate(today);
      const tomorrowDate = this.formatDate(tomorrow);
      const dayAfterTomorrowDate = this.formatDate(dayAfterTomorrow);
      return [
        {
          key: "today",
          main: formatMonth(today),
          sub: "今天",
          date: todayDate,
          disabled: !this.hasSessionForDate(todayDate),
        },
        {
          key: "tomorrow",
          main: formatMonth(tomorrow),
          sub: "明天",
          date: tomorrowDate,
          disabled: !this.hasSessionForDate(tomorrowDate),
        },
        {
          key: "day_after_tomorrow",
          main: formatMonth(dayAfterTomorrow),
          sub: "后天",
          date: dayAfterTomorrowDate,
          disabled: !this.hasSessionForDate(dayAfterTomorrowDate),
        },
        {
          key: "all",
          main: this.allDateLabel || "所有日期",
          sub: "",
          icon: true,
          wide: true,
        },
      ];
    },
  },

  onLoad(options) {
    this.navInsetPx = getNavBarInsetPx();
    if (options.prefill === "home") {
      this.$bus.once(HOME_TICKET_SECTION_EVENT, (section) => {
        if (section?.ticketEvent) {
          this.homeTicketSection = section;
          this.ticketTypes = Array.isArray(section.ticketTypes)
            ? section.ticketTypes
            : [];
          this.eventId =
            section.ticketEvent.id || options.eventId || options.id || "";
          this.sessionOptions = Array.isArray(section.sessions)
            ? section.sessions
            : [];
          const initialSessionId = section.sessionId || "";
          this.sessionSlot = String(initialSessionId).endsWith("-PM")
            ? "PM"
            : "AM";
          this.sessionId = initialSessionId;
          this.initDateSelection();
          if (
            initialSessionId &&
            this.sessionId === initialSessionId &&
            Array.isArray(this.ticketTypes) &&
            this.ticketTypes.length
          ) {
            this.ticketTypesCache = {
              ...this.ticketTypesCache,
              [initialSessionId]: this.ticketTypes.map((t) => ({ ...t })),
            };
          }
          if (this.selectedDate && this.sessionId) {
            this.loadTicketsForDateSelection(this.selectedDate).catch(() => {
              uni.showToast({ title: "加载票种失败，请重试", icon: "none" });
            });
          }
        } else {
          this.applyDefaultEventAndTickets(options);
        }
        if (options.ticketId) {
          this.$nextTick(() => {
            const ticket = this.ticketTypes.find(
              (t) => String(t.id) === String(options.ticketId),
            );
            if (ticket && ticket.stock > 0) {
              this.selectedTicket = ticket;
            }
          });
        }
      });
    } else {
      this.applyDefaultEventAndTickets(options);
      if (options.ticketId) {
        this.$nextTick(() => {
          const ticket = this.ticketTypes.find(
            (t) => String(t.id) === String(options.ticketId),
          );
          if (ticket && ticket.stock > 0) {
            this.selectedTicket = ticket;
          }
        });
      }
    }
  },

  methods: {
    showCloseForChip(chip) {
      if (!chip || chip.disabled) return false;
      return chip.key === "all" && this.activeDateKey === "all";
    },

    applyDefaultEventAndTickets(options) {
      this.eventId = options.eventId || options.id;
      this.loadEventInfo();
      this.loadTicketTypes();
    },

    mapInventoryToTicketTypes(rows) {
      return (rows || []).map((row) => ({
        id: row.id,
        name: row.name,
        price: row.price,
        originalPrice:
          row.name === "早鸟票" ? parseInt(row.price * 1.2) : row.price,
        description: `${row.refund_policy === "REFUNDABLE_48H_BEFORE" ? "开场前 48 小时可退" : "不可退票"} · ${row.valid_duration_days} 天有效 · 可入场 ${row.admittance} 人`,
        stock: typeof row.quantity === "number" ? row.quantity : 0,
        canRefund: row.refund_policy === "REFUNDABLE_48H_BEFORE",
        tag: row.name === "早鸟票" ? "限量" : "",
      }));
    },

    normalizeDateKey(value) {
      if (!value) return "";
      const text = String(value).trim();
      if (!text) return "";
      const d = dayjs(text);
      if (d.isValid()) return d.format("YYYY-MM-DD");
      return text.slice(0, 10);
    },

    sessionDateKey(session) {
      return this.normalizeDateKey(session?.date || session?.session_date);
    },

    sessionLastEntryAt(session) {
      const text = String(session?.last_entry_time || "").trim();
      if (!text) return null;
      const d = dayjs(text);
      return d.isValid() ? d : null;
    },

    inferSessionSlot(session) {
      const id = String(session?.id || "");
      const name = String(session?.name || "");
      if (/-PM$/.test(id) || /下午/.test(name)) return "PM";
      if (/-AM$/.test(id) || /上午/.test(name)) return "AM";
      return "";
    },

    sessionSortValue(session) {
      const opening = dayjs(String(session?.opening_time || "").trim());
      if (opening.isValid()) return opening.valueOf();

      const lastEntry = this.sessionLastEntryAt(session);
      if (lastEntry) return lastEntry.valueOf();

      const baseDate = dayjs(this.sessionDateKey(session));
      if (!baseDate.isValid()) return Number.MAX_SAFE_INTEGER;
      return (
        baseDate.startOf("day").valueOf() +
        (this.inferSessionSlot(session) === "PM" ? 1 : 0)
      );
    },

    compareSessions(a, b) {
      const diff = this.sessionSortValue(a) - this.sessionSortValue(b);
      if (diff !== 0) return diff;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    },

    isSessionAvailable(session) {
      if (!session?.id || !this.sessionDateKey(session)) return false;
      const lastEntry = this.sessionLastEntryAt(session);
      if (!lastEntry) return true;
      return !dayjs().isAfter(lastEntry);
    },

    sessionsForDate(date, { availableOnly = false } = {}) {
      const target = dayjs(String(date || "").trim());
      if (!target.isValid()) return [];

      return (this.sessionOptions || [])
        .filter((session) => {
          const current = dayjs(this.sessionDateKey(session));
          if (!current.isValid() || !current.isSame(target, "day")) return false;
          if (!availableOnly) return true;
          return this.isSessionAvailable(session);
        })
        .sort((a, b) => this.compareSessions(a, b));
    },

    resolveActiveKeyForDate(date) {
      const target = this.normalizeDateKey(date);
      if (!target) return "all";

      const today = dayjs().format("YYYY-MM-DD");
      if (target === today) return "today";
      if (target === dayjs().add(1, "day").format("YYYY-MM-DD")) {
        return "tomorrow";
      }
      if (target === dayjs().add(2, "day").format("YYYY-MM-DD")) {
        return "day_after_tomorrow";
      }
      return "all";
    },

    formatChipDateLabel(date) {
      const d = dayjs(String(date || "").trim());
      if (!d.isValid()) return "";
      return `${d.month() + 1}月${d.date()}日`;
    },

    resolveSelectableSession(date, preferredSlot = this.sessionSlot) {
      const availableSessions = this.sessionsForDate(date, { availableOnly: true });
      if (!availableSessions.length) return null;

      const preferred = availableSessions.find(
        (session) => this.inferSessionSlot(session) === preferredSlot,
      );
      return preferred || availableSessions[0];
    },

    getNearestAvailableSelection() {
      const availableSessions = (this.sessionOptions || [])
        .filter((session) => this.isSessionAvailable(session))
        .sort((a, b) => this.compareSessions(a, b));
      const session = availableSessions[0];
      if (!session) return null;

      const date = this.sessionDateKey(session);
      const activeKey = this.resolveActiveKeyForDate(date);
      const slot = this.inferSessionSlot(session) || "AM";

      return {
        session,
        date,
        slot,
        activeKey,
        allDateLabel: activeKey === "all" ? this.formatChipDateLabel(date) : "",
      };
    },

    hasSessionForDate(date) {
      return this.sessionsForDate(date, { availableOnly: true }).length > 0;
    },

    /** 按日期 + 上/下午选择场次 id；无半日拆分时退回当日唯一场次 */
    sessionIdByDateAndSlot(date, slot) {
      const sameDay = this.sessionsForDate(date, { availableOnly: true });
      if (!sameDay.length) return "";
      const suffix = slot === "PM" ? "-PM" : "-AM";
      const bySuffix = sameDay.find((s) => String(s.id).endsWith(suffix));
      if (bySuffix) return bySuffix.id;
      if (sameDay.length === 1) return sameDay[0].id;
      return "";
    },

    sessionSlotAvailable(slot) {
      const date = this.selectedDate;
      if (!date) return false;
      return Boolean(this.sessionIdByDateAndSlot(date, slot));
    },

    onSessionSlotClick(slot) {
      if (!this.halfDaySessionsEnabled) return;
      if (slot === this.sessionSlot) return;
      if (!this.selectedDate) return;
      if (!this.sessionSlotAvailable(slot)) {
        uni.showToast({ title: "该时段已不可购买", icon: "none" });
        return;
      }
      this.sessionSlot = slot;
      const sid = this.sessionIdByDateAndSlot(this.selectedDate, slot);
      if (!sid) return;
      this.sessionId = sid;
      const types = this.ticketTypesCache[sid];
      this.applyTicketSelectionFromTypes(types || []);
    },

    /** 将已选票种 id 尽量延续到新列表（库存变化时清空） */
    applyTicketSelectionFromTypes(types) {
      const list = Array.isArray(types) ? types : [];
      const prevSelectedId = this.selectedTicket?.id
        ? String(this.selectedTicket.id)
        : "";
      this.ticketTypes = list;
      if (!prevSelectedId) {
        this.selectedTicket = null;
        this.quantity = 1;
        return;
      }
      const matched = list.find(
        (t) => String(t.id) === prevSelectedId && t.stock > 0,
      );
      if (matched) {
        this.selectedTicket = matched;
        const max = Math.min(MAX_TICKETS_PER_ORDER, matched.stock || 1);
        if (this.quantity > max) this.quantity = max;
        if (this.quantity < 1) this.quantity = 1;
        return;
      }
      this.selectedTicket = null;
      this.quantity = 1;
    },

    async ensureTicketsForSession(sessionId) {
      const sid = String(sessionId || "");
      if (!sid || !this.eventId) return [];
      const hit = this.ticketTypesCache[sid];
      if (hit) return hit;
      const inv = await request.get(
        `/exhibition/${encodeURIComponent(this.eventId)}/sessions/${encodeURIComponent(sid)}/tickets`,
      );
      const types = this.mapInventoryToTicketTypes(
        Array.isArray(inv) ? inv : [],
      );
      this.ticketTypesCache = { ...this.ticketTypesCache, [sid]: types };
      return types;
    },

    /** 某日期的上/下午场各拉一次（半日模式并行），再展示当前场次 */
    async prefetchTicketsForDate(date) {
      if (!date || !this.eventId) return;
      if (!this.halfDaySessionsEnabled) {
        const sid = this.sessionIdByDateAndSlot(date, this.sessionSlot);
        if (sid) await this.ensureTicketsForSession(sid);
        return;
      }
      const amSid = this.sessionIdByDateAndSlot(date, "AM");
      const pmSid = this.sessionIdByDateAndSlot(date, "PM");
      const ids = [...new Set([amSid, pmSid].filter(Boolean))];
      await Promise.all(ids.map((id) => this.ensureTicketsForSession(id)));
    },

    async loadTicketsForDateSelection(date) {
      const sid = this.sessionId;
      if (!sid || !this.eventId) {
        this.ticketTypes = [];
        this.selectedTicket = null;
        this.quantity = 1;
        return;
      }
      await this.prefetchTicketsForDate(date);
      const types = this.ticketTypesCache[sid] || [];
      this.applyTicketSelectionFromTypes(types);
    },

    async applyDateSelection(date, activeKey) {
      if (!date) return;
      const session = this.resolveSelectableSession(date, this.sessionSlot);
      if (!session?.id) {
        uni.showToast({ title: "该日期暂无可选场次", icon: "none" });
        return;
      }
      const slot = this.inferSessionSlot(session) || this.sessionSlot || "AM";
      this.selectedDate = date;
      this.activeDateKey = activeKey;
      this.allDateLabel =
        activeKey === "all" ? this.formatChipDateLabel(date) : "";
      this.sessionSlot = slot;
      this.sessionId = session.id;
      await this.loadTicketsForDateSelection(date);
    },

    initDateSelection() {
      const selection = this.getNearestAvailableSelection();
      if (!selection?.session?.id) {
        this.selectedDate = "";
        this.activeDateKey = "today";
        this.allDateLabel = "";
        this.sessionId = "";
        this.ticketTypes = [];
        this.selectedTicket = null;
        return;
      }
      this.selectedDate = selection.date;
      this.activeDateKey = selection.activeKey;
      this.allDateLabel = selection.allDateLabel;
      this.sessionSlot = selection.slot;
      this.sessionId = selection.session.id;
    },

    /** 取消当前日期筛选：回到首个有场次的预设日，并刷新票种 */
    async clearDateSelection() {
      this.allDateLabel = "";
      this.sessionSlot = "AM";
      this.initDateSelection();
      const sid = this.sessionId;
      if (sid && this.selectedDate) {
        await this.loadTicketsForDateSelection(this.selectedDate);
      } else {
        this.ticketTypes = [];
        this.selectedTicket = null;
        this.quantity = 1;
      }
    },

    formatDate(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    },

    loadEventInfo() {
      const event = mockHomeCards.find((item) => item.id == this.eventId);
      if (event) {
        this.eventName = event.title;
        this.eventDate = event.date;
        this.museumLocation = event.location || this.museumLocation;
      }
    },

    loadTicketTypes() {
      this.ticketTypes = mockTicketTypes;
    },

    selectTicket(ticket) {
      if (ticket.stock > 0) {
        this.selectedTicket = ticket;
        const cap = Math.min(MAX_TICKETS_PER_ORDER, ticket.stock);
        if (this.quantity > cap) {
          this.quantity = cap;
        }
      } else {
        uni.showToast({ title: "该票种已售罄", icon: "none" });
      }
    },

    decreaseQuantity() {
      if (this.quantity > 1) {
        this.quantity--;
      }
    },

    increaseQuantity() {
      const max = this.maxSelectableQuantity;
      if (this.quantity < max) {
        this.quantity++;
      } else {
        uni.showToast({ title: `最多购买${max}张`, icon: "none" });
      }
    },

    async onChipClick(chip) {
      if (chip.disabled) {
        uni.showToast({ title: "该日期暂无可选场次", icon: "none" });
        return;
      }
      if (!chip.date) return;
      await this.applyDateSelection(chip.date, chip.key);
    },

    async onAllDateChange(e) {
      const pickedDate = e.detail.value;
      await this.applyDateSelection(pickedDate, "all");
    },

    getToken() {
      const raw = persistStorage.getItem("user");
      if (!raw) return "";
      try {
        const state = typeof raw === "string" ? JSON.parse(raw) : raw;
        return state?.token || "";
      } catch (e) {
        return "";
      }
    },

    pickApiErrorMessage(err) {
      const data = err?.data;
      if (data && typeof data === "object" && data.message) {
        return String(data.message);
      }
      if (typeof data === "string") return data;
      const code = err?.statusCode;
      if (code === 409) return "库存不足，请减少张数或稍后再试";
      if (code === 410) return "该场次已过期";
      if (code === 404) return "展览或场次不存在";
      if (code === 400) return "参数错误，请重新选择";
      return "创建订单失败";
    },

    async handlePayButtonClick() {
      await this.handlePurchase();
    },

    async handlePurchase() {
      if (!this.selectedTicket) {
        uni.showToast({ title: "请选择票种", icon: "none" });
        return;
      }

      const eid = this.eventId || this.homeTicketSection?.ticketEvent?.id || "";
      const sid = this.sessionId || this.homeTicketSection?.sessionId || "";
      if (!eid || !sid) {
        uni.showToast({
          title: "缺少场次信息，请从首页进入购票",
          icon: "none",
        });
        return;
      }

      if (!this.getToken()) {
        uni.showToast({ title: "请先登录", icon: "none" });
        uni.navigateTo({ url: "/pages/login/login" });
        return;
      }

      try {
        uni.showLoading({ title: "创建订单...", mask: true });
        const order = await createOrder(eid, sid, [
          {
            ticket_category_id: String(this.selectedTicket.id),
            quantity: this.quantity,
          },
        ]);
        uni.hideLoading();

        const ev = this.homeTicketSection?.ticketEvent;
        const sectionCtx = {
          ticketEvent: ev
            ? { ...ev }
            : {
                title: this.heroTitle,
                cover: this.heroCover,
                location: this.infoMuseumLocation,
                contact_phone: this.contactPhone,
                session_date: null,
              },
          ticketTypes: (this.ticketTypes || []).map((t) => ({
            id: t.id,
            name: t.name,
          })),
          visitDate: this.selectedDate || "",
        };
        try {
          uni.setStorageSync(ORDER_CONFIRM_CONTEXT_KEY, sectionCtx);
        } catch (e) {
          console.error("order_confirm_context setStorage", e);
        }

        uni.navigateTo({
          url: `/pages/order-confirm/order-confirm?orderId=${encodeURIComponent(order.id)}`,
        });
      } catch (err) {
        uni.hideLoading();
        uni.showToast({
          title: this.pickApiErrorMessage(err),
          icon: "none",
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.purchase-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
  position: relative;
}

.purchase-scroll {
  width: 100%;
  height: 100vh;
}

/* ===== 顶部大图区域 ===== */
.hero-section {
  position: relative;
  width: 100%;
  height: 570rpx;
  overflow: hidden;
  margin-top: 26rpx;
}

.hero-bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.hero-gradient {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(9, 10, 7, 0) 40%, $cr7-black 96%);
}

.hero-bottom {
  position: absolute;
  left: 35rpx;
  right: 35rpx;
  bottom: 20rpx;
  z-index: 2;
}

.hero-title {
  display: block;
  font-size: 48rpx;
  color: $text-white;
  font-weight: 700;
  line-height: 1.1;
}

.hero-sub {
  display: block;
  margin-top: 10rpx;
  font-size: $font-xs;
  color: $text-light;
}

/* ===== 信息区域 ===== */
.info-section {
  padding: 24rpx 35rpx 0;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 12rpx;
}

/* 两行时间：图标与第一行文字垂直对齐，不与整块居中 */
.info-row-time {
  align-items: flex-start;
}

.info-row-time .info-icon {
  /* 首行行高 38rpx、图标 24rpx，与第一行视觉中线对齐 */
  margin-top: 7rpx;
  flex-shrink: 0;
}

.info-icon {
  flex-shrink: 0;
}

.info-text-col {
  display: flex;
  flex-direction: column;
}

.info-text {
  font-size: 26rpx;
  color: $text-white;
  line-height: 38rpx;
}

.info-text-indent {
  padding-left: 0;
}

/* ===== 描述卡片 ===== */
.desc-card {
  margin: 28rpx 27rpx 0;
  border-radius: $radius-lg;
  overflow: hidden;
  position: relative;
  background: $cr7-dark;
}

.desc-card-bg {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, $cr7-dark 0%, rgba(22, 23, 20, 0) 100%);
  z-index: 1;
}

.desc-card-content {
  position: relative;
  z-index: 2;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
}

.desc-main {
  font-size: 32rpx;
  color: $text-white;
  font-weight: 500;
  line-height: 1.5;
}

.desc-sub {
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-light;
  line-height: 1.5;
}

.desc-link {
  margin-top: 16rpx;
  font-size: $font-xs;
  color: $cr7-gold;
  text-decoration: underline;
}

/* ===== 选择票种区域 ===== */
.ticket-section {
  padding: 32rpx 30rpx 0;
}

.section-title {
  font-size: 38rpx;
  color: $text-white;
  font-weight: 400;
  line-height: 54rpx;
  margin-bottom: $spacing-md;
  display: block;
}

.date-chips {
  display: flex;
  align-items: center;
  // gap: $spacing-sm;
  justify-content: space-between;
}

.date-chip {
  position: relative;
  // min-width: 138rpx;
  height: 64rpx;
  border-radius: 21rpx;
  background: $cr7-dark;
  border: 2rpx solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 14rpx;
  overflow: visible;
  z-index: 1;
}

.date-chip-close {
  position: absolute;
  top: -16rpx;
  right: -16rpx;
  z-index: 2;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  background: $cr7-gold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.date-chip-wide {
  // width: 197rpx;
  // padding: 0 16rpx;
  width: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9rpx;
}

.chip-icon {
  width: 24rpx;
  height: 24rpx;
  flex-shrink: 0;
}

.chip-main {
  font-size: 24rpx;
  line-height: 24rpx;
  color: $text-white;
  font-weight: 400;
}

.chip-sub {
  margin-left: 9rpx;
  font-size: 24rpx;
  line-height: 24rpx;
  color: $text-white;
  font-weight: 400;
}

.date-chip.active {
  border-color: $cr7-gold;
  z-index: 3;
}

.date-chip.disabled {
  opacity: 0.45;
}

.date-chip.active .chip-main,
.date-chip.active .chip-sub {
  color: $cr7-gold;
}

/* 上午场 / 下午场（Figma 68473:13841，334×64 / 圆角 21） */
.session-slot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 24rpx;
  width: 100%;
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

.session-slot-pill.disabled {
  opacity: 0.45;
}

/* ===== 票种列表 ===== */
.ticket-list {
  padding: 24rpx 30rpx 0;
}

.ticket-card {
  position: relative;
  background: $cr7-dark;
  border-radius: $radius-lg;
  padding: 30rpx;
  margin-bottom: 23rpx;
  overflow: visible;
}

.ticket-card.active {
  border: 2rpx solid $cr7-gold;
}

.ticket-tag-badge {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  background: $cr7-gold;
  border-radius: 999rpx;
  padding: 0 15rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36rpx;
}

.ticket-tag-text {
  font-size: 19rpx;
  color: #0f2316;
  font-weight: 500;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.ticket-card-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.ticket-name {
  font-size: 30rpx;
  color: $text-white;
  font-weight: 700;
  line-height: 46rpx;
}

.ticket-desc {
  font-size: 24rpx;
  color: $text-disabled;
  line-height: 38rpx;
}

.ticket-right {
  margin-left: $spacing-sm;
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
}

.ticket-price-origin {
  font-size: 28rpx;
  color: $text-disabled;
  text-decoration: line-through;
  margin-right: 8rpx;
}

.ticket-price-now {
  font-size: 30rpx;
  color: $text-white;
  font-weight: 700;
  line-height: 46rpx;
}

.ticket-price-now.price-gold {
  color: $cr7-gold;
}

/* ===== 选择张数 ===== */
.quantity-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  // margin: 0 30rpx 0;
  border-radius: $radius-lg;
  background: transparent;
}

.quantity-section__title {
  margin-bottom: 0;
  flex-shrink: 0;
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 48rpx;
}

.quantity-btn {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quantity-btn-minus {
  background: $cr7-card;
}

.quantity-btn-minus.disabled {
  opacity: 0.5;
}

.quantity-btn-plus.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.quantity-btn-plus {
  background: $cr7-card;
}

.quantity-btn-icon {
  font-size: 32rpx;
  color: $text-light;
  font-weight: 400;
  line-height: 1;
}

.quantity-btn-icon.plus {
  color: $cr7-gold;
  font-weight: 700;
}

.quantity-value {
  font-size: 38rpx;
  color: $text-white;
  font-weight: 700;
  line-height: 54rpx;
}

/* ===== 购票须知入口 ===== */
.notice-entry {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8rpx 30rpx 20rpx;
}

.notice-icon {
  font-size: 24rpx;
  color: $text-light;
  margin-right: 8rpx;
}

.notice-text {
  font-size: 24rpx;
  color: $text-light;
}

/* ===== 底部占位 ===== */
.scroll-bottom-space {
  height: 160rpx;
}

/* ===== 底部总额 + 按钮（参考订单确认页） ===== */
.purchase-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  border-top: 1rpx solid $cr7-border;
  background: $cr7-dark;
}

.purchase-footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15rpx 30rpx 12rpx;
}

.footer-total {
  display: flex;
  flex-direction: column;
}

.total-label {
  font-size: 23rpx;
  color: $text-light;
  letter-spacing: 1rpx;
  text-transform: uppercase;
  line-height: 30rpx;
}

.total-value {
  font-size: 46rpx;
  color: $cr7-gold;
  font-weight: 700;
  line-height: 62rpx;
}

.purchase-bottom-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pay-btn,
.purchase-bottom-bar :deep(button.pay-btn) {
  width: 518rpx;
  height: 98rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: $cr7-black;
}

.pay-btn[disabled],
.purchase-bottom-bar :deep(button.pay-btn[disabled]) {
  opacity: 0.4;
}
</style>
