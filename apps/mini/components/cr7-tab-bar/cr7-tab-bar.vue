<template>
  <view class="cr7-tab-bar" :style="{ paddingBottom: safeAreaBottom + 'px' }">
    <view class="cr7-tab-bar__inner">
      <view
        v-for="(item, index) in list"
        :key="index"
        :class="['cr7-tab-bar__item', { active: index === current }]"
        @click="onTap(index)"
      >
        <image
          :src="index === current ? item.selectedIconPath : item.iconPath"
          class="cr7-tab-bar__icon"
          mode="aspectFit"
        />
        <text
          v-if="showLabel(index)"
          class="cr7-tab-bar__text"
        >{{ item.text }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'Cr7TabBar',
  props: {
    current: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      safeAreaBottom: 0,
      list: [
        {
          pagePath: '/pages/index/index',
          iconPath: '/static/home.png',
          selectedIconPath: '/static/home.png',
          text: '首页'
        },
        {
          pagePath: '/pages/my-tickets/my-tickets',
          iconPath: '/static/ticket.png',
          selectedIconPath: '/static/ticket.png',
          text: '票夹'
        },
        {
          pagePath: '/pages/game/game',
          iconPath: '/static/game.png',
          selectedIconPath: '/static/game.png',
          text: '互动'
        },
        {
          pagePath: '/pages/profile/profile',
          iconPath: '/static/profile.png',
          selectedIconPath: '/static/profile.png',
          text: '我的'
        }
      ]
    }
  },
  mounted() {
    const sys = uni.getSystemInfoSync()
    if (sys.safeAreaInsets && typeof sys.safeAreaInsets.bottom === 'number') {
      this.safeAreaBottom = sys.safeAreaInsets.bottom
    } else if (sys.safeArea && sys.screenHeight) {
      this.safeAreaBottom = Math.max(0, sys.screenHeight - sys.safeArea.bottom)
    } else {
      this.safeAreaBottom = 0
    }
  },
  methods: {
    showLabel(index) {
      return (index === 0 || index === 3) && index === this.current
    },
    onTap(index) {
      if (index === this.current) return
      uni.switchTab({
        url: this.list[index].pagePath
      })
    }
  }
}
</script>

<style lang="scss" scoped>
$nav-bg: #161714;
$nav-item-bg: #2A2A2A;
$nav-active-bg: #D8FC0F;
$nav-active-text: #090A07;

.cr7-tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding-left: 35rpx;
  padding-right: 35rpx;
  padding-top: 21rpx;
  z-index: 999;
}

.cr7-tab-bar__inner {
  height: 126rpx;
  background: $nav-bg;
  border-radius: 64rpx;
  box-shadow: 0 0 42rpx rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10rpx;
  gap: 10rpx;
}

.cr7-tab-bar__item {
  flex: 1;
  min-width: 0;
  height: 105rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border-radius: 64rpx;
  background: $nav-item-bg;
  transition: background 0.2s;

  &.active {
    background: $nav-active-bg;

    .cr7-tab-bar__text {
      color: $nav-active-text;
      font-weight: 500;
    }
  }
}

.cr7-tab-bar__item.active:first-child,
.cr7-tab-bar__item.active:last-child {
  flex: 0 0 220rpx;
}

.cr7-tab-bar__icon {
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
}

.cr7-tab-bar__text {
  font-size: 28rpx;
  color: #FFFFFF;
  line-height: 42rpx;
  white-space: nowrap;
}
</style>
