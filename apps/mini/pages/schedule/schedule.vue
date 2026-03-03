<template>
  <view class="schedule-page">
    <scroll-view class="schedule-scroll" scroll-y>
      <view class="section">
        <text class="section-title">C罗职业生涯时间轴</text>
        <text class="section-sub">从里斯本到世界之巅的每一个关键节点</text>
      </view>

      <view class="timeline">
        <view
          v-for="item in schedule"
          :key="item.id"
          class="timeline-item card-dark"
        >
          <view class="timeline-row">
            <view class="timeline-date-badge">
              <text class="timeline-date-text">{{ item.date }}</text>
            </view>
            <view class="timeline-main">
              <text class="timeline-event">{{ item.event }}</text>
              <text class="timeline-location">📍 {{ item.location }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>
  </view>
</template>

<script>
import { mockSchedule } from '@/utils/mockData.js'

export default {
  data() {
    return {
      schedule: []
    }
  },

  onLoad() {
    this.schedule = mockSchedule
  }
}
</script>

<style lang="scss" scoped>
.schedule-page {
  min-height: 100vh;
  background: $cr7-black;
}

.schedule-scroll {
  padding: 24rpx 24rpx 0;
}

.section {
  margin-bottom: 16rpx;
}

.section-title {
  font-size: $font-lg;
  color: $text-white;
  font-weight: 600;
}

.section-sub {
  margin-top: 4rpx;
  font-size: $font-sm;
  color: $text-light;
}

.timeline {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.timeline-item {
  padding: 16rpx 20rpx;
}

.timeline-row {
  display: flex;
  align-items: center;
}

.timeline-date-badge {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(216, 252, 15, 0.18);
  margin-right: 16rpx;
}

.timeline-date-text {
  font-size: $font-xs;
  color: $cr7-gold-light;
}

.timeline-main {
  flex: 1;
}

.timeline-event {
  font-size: $font-md;
  color: $text-white;
  font-weight: 600;
}

.timeline-location {
  margin-top: 4rpx;
  font-size: $font-sm;
  color: $text-light;
}

.safe-bottom {
  height: 80rpx;
}
</style>
