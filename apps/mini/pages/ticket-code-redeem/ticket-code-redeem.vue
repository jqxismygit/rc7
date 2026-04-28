<template>
  <view class="redeem-page">
    <cr7-nav-bar title="票码兑换" fallback-url="/pages/my-tickets/my-tickets" />

    <scroll-view
      class="page-scroll"
      scroll-y
      :style="{ paddingTop: navInsetPx + 'px' }"
    >
      <view class="main">
        <view class="hero">
          <view class="hero-icon-wrap">
            <sx-svg name="ticket2" :width="53" :height="35" color="#D8FC0F" />
          </view>
          <text class="hero-title">输入兑换码</text>
          <text class="hero-desc">输入兑换码，将票券转入 CR7@LIFE 票夹</text>
        </view>

        <view class="input-card">
          <view class="form-block">
            <text class="input-label">兑换码</text>
            <input
              v-model.trim="code"
              class="code-input"
              placeholder="输入兑换码"
              placeholder-style="color:#787878"
              maxlength="64"
            />
            <picker
              mode="selector"
              :range="sessionLabels"
              :value="sessionPickerIndex"
              :disabled="!sessions.length"
              @change="onSessionChange"
            >
              <view class="date-field">
                <text
                  class="date-field-text"
                  :class="{ 'is-placeholder': !selectedSessionId }"
                >
                  {{ sessionDisplayText }}
                </text>
                <sx-svg
                  name="date-range"
                  :width="42"
                  :height="42"
                  color="#ADADAD"
                />
              </view>
            </picker>
          </view>
          <button
            class="submit-btn"
            :disabled="!canSubmit"
            @click="handleSubmit"
          >
            {{ submitting ? "兑换中..." : "立即兑换" }}
          </button>
        </view>

        <view class="tips">
          <view class="tips-title-row">
            <sx-svg name="info" :width="24" :height="24" color="#ADADAD" />
            <text class="tips-title">温馨提示</text>
          </view>
          <view class="tips-card">
            <text class="tips-item">
              1.
              支持在合作平台/线下渠道购买的票券，通过兑换码同步到当前微信账号；
            </text>
            <text class="tips-item">2. 每个兑换码仅限使用一次；</text>
            <text class="tips-item">
              3. 兑换成功后，票务信息将自动同步至「我的票夹」
            </text>
          </view>
        </view>

        <view class="safe-bottom safe-area-bottom"></view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import Cr7NavBar from "@/components/cr7-nav-bar/cr7-nav-bar.vue";
import { getNavBarInsetPx } from "@/utils/navBar.js";
import { redeemCdkeyForSession } from "@/services/redeem.js";
import { loadHomeTicketSection } from "@/services/home.js";

function formatSessionLabel(session) {
  if (!session) return "";
  const d = String(session.date || session.session_date || "").trim();
  const name = String(session.name || "").trim();
  if (d && name) return `${d} ${name}`;
  return d || name || "场次";
}

export default {
  components: {
    Cr7NavBar,
  },

  data() {
    return {
      code: "",
      navInsetPx: 0,
      submitting: false,
      sessions: [],
      selectedSessionId: "",
      sectionLoading: false,
    };
  },

  computed: {
    sessionLabels() {
      return (this.sessions || []).map((s) => formatSessionLabel(s));
    },
    sessionPickerIndex() {
      if (!this.selectedSessionId) return 0;
      const i = (this.sessions || []).findIndex(
        (s) => s.id === this.selectedSessionId,
      );
      return i >= 0 ? i : 0;
    },
    sessionDisplayText() {
      if (!this.sessions.length) return "暂无可选场次，请稍后再试";
      if (!this.selectedSessionId) return "请选择日期";
      const s = this.sessions.find((x) => x.id === this.selectedSessionId);
      return s ? formatSessionLabel(s) : "请选择日期";
    },
    canSubmit() {
      return (
        Boolean(this.code) &&
        Boolean(this.selectedSessionId) &&
        !this.submitting &&
        !this.sectionLoading
      );
    },
  },

  onLoad() {
    this.navInsetPx = getNavBarInsetPx();
    this.loadSessions();
  },

  methods: {
    onSessionChange(e) {
      const i = Number(e?.detail?.value);
      if (Number.isNaN(i) || i < 0) return;
      this.selectedSessionId = this.sessions[i]?.id || "";
    },

    async loadSessions() {
      this.sectionLoading = true;
      try {
        const section = await loadHomeTicketSection();
        const list = Array.isArray(section.sessions) ? section.sessions : [];
        this.sessions = list;
        const sid = section.sessionId || "";
        this.selectedSessionId =
          sid && list.some((s) => s.id === sid) ? sid : list[0]?.id || "";
      } catch {
        this.sessions = [];
        this.selectedSessionId = "";
        uni.showToast({ title: "场次加载失败", icon: "none" });
      } finally {
        this.sectionLoading = false;
      }
    },

    pickErrorMessage(err) {
      const code = err?.statusCode;
      if (err?.message) {
        return err?.message;
      }
      if (code === 400) return "请检查兑换码与场次后重试";
      if (code === 401) return "请先登录后再兑换";
      if (code === 404) return "兑换码或场次不存在";
      if (code === 409) return "库存不足";
      if (code === 410) return "兑换码已过期";
      return "兑换失败，请稍后重试";
    },

    async handleSubmit() {
      if (!this.code) {
        uni.showToast({ title: "请输入兑换码", icon: "none" });
        return;
      }
      if (!this.selectedSessionId) {
        uni.showToast({ title: "请选择日期", icon: "none" });
        return;
      }
      if (this.submitting) return;

      this.submitting = true;
      try {
        uni.showLoading({ title: "兑换中...", mask: true });
        await redeemCdkeyForSession(this.selectedSessionId, {
          code: this.code,
        });
        uni.hideLoading();
        uni.showToast({
          title: "兑换成功，已加入票夹",
          icon: "success",
        });
        this.code = "";
        setTimeout(() => {
          uni.switchTab({
            url: "/pages/my-tickets/my-tickets",
          });
        }, 1200);
      } catch (err) {
        uni.hideLoading();
        uni.showToast({
          title: this.pickErrorMessage(err),
          icon: "none",
        });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.redeem-page {
  height: 100vh;
  background: $cr7-black;
}

.page-scroll {
  height: 100vh;
  box-sizing: border-box;
}

.main {
  padding: 0 30rpx 0;
}

.hero {
  padding-top: 62rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-icon-wrap {
  width: 160rpx;
  height: 160rpx;
  border-radius: 19228rpx;
  background: rgba(216, 251, 14, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-title {
  margin-top: 40rpx;
  font-size: 40rpx;
  line-height: 69rpx;
  color: #f1f5f9;
  font-weight: 500;
}

.hero-desc {
  margin-top: 24rpx;
  font-size: 27rpx;
  line-height: 38rpx;
  color: $text-light;
  text-align: center;
}

.input-card {
  margin-top: 62rpx;
  background: $cr7-dark;
  border-radius: 32rpx;
  padding: 46rpx;
  box-shadow: 0 48rpx 96rpx -23rpx rgba(0, 0, 0, 0.25);
}

.form-block {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.input-label {
  font-size: 23rpx;
  line-height: 31rpx;
  color: #787878;
  letter-spacing: 2rpx;
}

.code-input {
  margin-top: 16rpx;
  height: 98rpx;
  border-radius: 16rpx;
  border: 1.75rpx solid #787878;
  background: $cr7-dark;
  color: $text-white;
  font-size: 30rpx;
  padding: 0 35rpx;
  box-sizing: border-box;
}

.date-field {
  margin-top: 16rpx;
  height: 98rpx;
  border-radius: 28rpx;
  border: 1.75rpx solid #787878;
  background: $cr7-dark;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 35rpx;
  box-sizing: border-box;
}

.date-field-text {
  flex: 1;
  font-size: 30rpx;
  line-height: 42rpx;
  color: $text-white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 16rpx;
}

.date-field-text.is-placeholder {
  color: #adadad;
}

.submit-btn {
  margin-top: 46rpx;
  width: 100%;
  height: 97rpx;
  border-radius: 62rpx;
  background: $cr7-gold;
  color: $cr7-black;
  font-size: 31rpx;
  line-height: 97rpx;
  font-weight: 500;
  border: none;
}

.submit-btn::after {
  border: none;
}

.submit-btn[disabled] {
  opacity: 0.5;
}

.tips {
  margin-top: 46rpx;
}

.tips-title-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.tips-title {
  font-size: 31rpx;
  line-height: 46rpx;
  color: $text-white;
  font-weight: 500;
}

.tips-card {
  margin-top: 23rpx;
  background: $cr7-dark;
  border-radius: 32rpx;
  padding: 31rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.tips-item {
  font-size: 24rpx;
  line-height: 44rpx;
  color: $text-light;
}

.safe-bottom {
  height: 80rpx;
}
</style>
