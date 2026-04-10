<template>
  <button
    :class="customClass"
    :disabled="disabled || isBindingPhone"
    :loading="loading || isBindingPhone"
    :open-type="requirePhoneAuth ? 'getPhoneNumber' : ''"
    @click="handleClick"
    @getphonenumber="handleGetPhoneNumber"
  >
    <slot />
  </button>
</template>

<script>
import persistStorage from "@/utils/persistStorage.js";
import { bindWechatPhone, fetchProfile } from "@/services/auth.js";
import { useUserStore } from "@/stores/user.js";

export default {
  name: "WechatPhoneAuthButton",
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    customClass: {
      type: String,
      default: "",
    },
    loginUrl: {
      type: String,
      default: "/pages/login/login",
    },
  },
  data() {
    return {
      requirePhoneAuth: false,
      isBindingPhone: false,
    };
  },
  methods: {
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

    normalizeProfilePhone(profile) {
      return String(profile?.phone || "").trim();
    },

    async syncRequirePhoneAuthState() {
      if (!this.getToken()) {
        this.requirePhoneAuth = false;
        return;
      }
      try {
        const profile = await fetchProfile();
        useUserStore().setProfile(profile);
        this.requirePhoneAuth = !this.normalizeProfilePhone(profile);
      } catch (e) {
        this.requirePhoneAuth = false;
      }
    },

    async handleClick() {
      if (this.disabled || this.isBindingPhone) return;

      if (!this.getToken()) {
        uni.showToast({ title: "请先登录", icon: "none" });
        uni.navigateTo({ url: this.loginUrl });
        this.$emit("need-login");
        return;
      }

      await this.syncRequirePhoneAuthState();
      if (this.requirePhoneAuth) {
        // 在微信环境下会由 open-type=getPhoneNumber 拉起授权
        return;
      }

      this.$emit("authorized-click");
    },

    async handleGetPhoneNumber(e) {
      if (this.disabled || this.isBindingPhone || !this.requirePhoneAuth) return;

      const code = e?.detail?.code;
      if (!code) {
        uni.showToast({ title: "需先授权手机号后再继续", icon: "none" });
        this.$emit("auth-fail", e);
        return;
      }

      try {
        this.isBindingPhone = true;
        uni.showLoading({ title: "绑定手机号...", mask: true });
        await bindWechatPhone(code);
        await this.syncRequirePhoneAuthState();
      } catch (err) {
        uni.showToast({ title: "手机号绑定失败，请稍后重试", icon: "none" });
        this.$emit("auth-fail", err);
        return;
      } finally {
        uni.hideLoading();
        this.isBindingPhone = false;
      }

      if (!this.requirePhoneAuth) {
        this.$emit("auth-success");
        this.$emit("authorized-click");
      }
    },
  },
};
</script>

<style scoped>
button::after {
  border: none;
}
</style>
