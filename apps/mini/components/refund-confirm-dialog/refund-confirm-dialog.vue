<template>
  <view v-if="show" class="refund-confirm-dialog" @touchmove.stop.prevent>
    <view class="rcd-mask" @click="onCancel" @touchmove.stop.prevent />
    <view class="rcd-panel" @click.stop>
      <view class="rcd-header">
        <text class="rcd-title">{{ title }}</text>
        <text class="rcd-subtitle">{{ subtitle }}</text>
      </view>

      <!-- 不用 scroll-view：微信端 scroll-view 无固定高度时高度常为 0，列表会整段不渲染 -->
      <view class="rcd-reason-wrap">
        <view class="rcd-reason-list">
          <view
            v-for="(item, index) in resolvedReasons"
            :key="item.value + '-' + index"
            class="rcd-reason-row"
            :class="{ 'is-selected': selectedIndex === index }"
            @click="selectIndex(index)"
          >
            <text class="rcd-reason-label">{{ item.label }}</text>
            <view class="rcd-radio" :class="{ checked: selectedIndex === index }">
              <view v-if="selectedIndex === index" class="rcd-radio-dot" />
            </view>
          </view>
        </view>
      </view>

      <view class="rcd-actions">
        <button
          class="rcd-btn rcd-btn-cancel"
          hover-class="none"
          plain
          @click="onCancel"
        >
          {{ cancelText }}
        </button>
        <button
          class="rcd-btn rcd-btn-confirm"
          hover-class="none"
          plain
          @click="onConfirm"
        >
          {{ confirmText }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { REFUND_REASON_OPTIONS } from "@/config/refund-reasons.js";

export default {
  name: "RefundConfirmDialog",

  props: {
    show: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: "申请退票",
    },
    subtitle: {
      type: String,
      default: "",
    },
    /**
     * 可选原因列表；小程序端父组件传数组偶发丢失，组件内用 config 兜底
     * @type {{ label: string; value: string }[]}
     */
    reasonOptions: {
      type: Array,
      default: () => [],
    },
    cancelText: {
      type: String,
      default: "取消",
    },
    confirmText: {
      type: String,
      default: "确认",
    },
    /** 打开弹窗时默认选中的下标 */
    defaultIndex: {
      type: Number,
      default: 0,
    },
  },

  data() {
    return {
      selectedIndex: 0,
    };
  },

  computed: {
    resolvedReasons() {
      const v = this.reasonOptions;
      if (Array.isArray(v) && v.length > 0) {
        return v;
      }
      return REFUND_REASON_OPTIONS;
    },
  },

  watch: {
    show(val) {
      if (val) {
        const list = this.resolvedReasons;
        const max = Math.max(0, list.length - 1);
        const i =
          typeof this.defaultIndex === "number" && this.defaultIndex >= 0
            ? Math.min(this.defaultIndex, max)
            : 0;
        this.selectedIndex = i;
      }
    },
    reasonOptions: {
      deep: true,
      handler() {
        if (this.show) {
          const max = Math.max(0, this.resolvedReasons.length - 1);
          this.selectedIndex = Math.min(this.selectedIndex, max);
        }
      },
    },
  },

  methods: {
    selectIndex(index) {
      this.selectedIndex = index;
    },

    onCancel() {
      this.$emit("cancel");
    },

    onConfirm() {
      const item = this.resolvedReasons[this.selectedIndex];
      if (!item) {
        this.$emit("confirm", { item: null, index: -1, value: "", label: "" });
        return;
      }
      this.$emit("confirm", {
        item,
        index: this.selectedIndex,
        value: item.value,
        label: item.label,
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.refund-confirm-dialog {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rcd-mask {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(9, 10, 7, 0.6);
}

.rcd-panel {
  position: relative;
  z-index: 1;
  width: 680rpx;
  max-height: 85vh;
  box-sizing: border-box;
  padding: 56rpx 28rpx;
  background: $cr7-dark;
  border-radius: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 60rpx;
}

.rcd-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.rcd-title {
  font-size: 35rpx;
  line-height: 52rpx;
  font-weight: 400;
  color: $text-white;
  text-align: center;
  font-family: "PingFang SC", sans-serif;
}

.rcd-subtitle {
  margin-top: 46rpx;
  font-size: 30rpx;
  line-height: 42rpx;
  font-weight: 400;
  color: $text-light;
  text-align: center;
  font-family: "PingFang SC", sans-serif;
}

.rcd-reason-wrap {
  flex-shrink: 0;
  width: 100%;
  max-height: 640rpx;
  overflow-y: auto;
}

.rcd-reason-list {
  display: flex;
  flex-direction: column;
  gap: 35rpx;
}

.rcd-reason-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 100rpx;
  padding: 28rpx 21rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
}

.rcd-reason-row.is-selected {
  background: $cr7-card;
  border: 1rpx solid $cr7-border;
  border-radius: 28rpx;
}

.rcd-reason-label {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  line-height: 42rpx;
  font-weight: 400;
  color: $text-white;
  font-family: "PingFang SC", sans-serif;
}

.rcd-radio {
  width: 42rpx;
  height: 42rpx;
  border-radius: 50%;
  border: 2rpx solid #ffffff;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rcd-radio.checked {
  border-color: #ffffff;
}

.rcd-radio-dot {
  width: 22rpx;
  height: 22rpx;
  border-radius: 50%;
  background: $cr7-gold;
}

.rcd-actions {
  display: flex;
  flex-direction: row;
  gap: 28rpx;
  flex-shrink: 0;
}

.rcd-btn {
  flex: 1;
  height: 81rpx;
  line-height: 81rpx;
  border-radius: 30rpx;
  font-size: 32rpx;
  font-weight: 500;
  font-family: "PingFang SC", sans-serif;
  padding: 0;
  margin: 0;
}

.rcd-btn::after {
  border: none;
}

.rcd-btn-cancel {
  color: $cr7-gold;
  background: transparent;
  border: 3rpx solid $cr7-gold;
}

.rcd-btn-confirm {
  color: $cr7-black;
  background: $cr7-gold;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
}
</style>
