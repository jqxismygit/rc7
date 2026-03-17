<template>
  <view class="schedule-page">
    <scroll-view class="schedule-scroll" scroll-y>
      <view class="section">
        <text class="section-title">C罗职业生涯时间轴</text>
        <text class="section-sub">从里斯本到世界之巅的每一个关键节点</text>
      </view>

      <view class="timeline">
        <view
          v-for="(item, index) in schedule"
          :key="item.id"
          class="timeline-row"
        >
          <view class="timeline-axis">
            <view class="timeline-dot"></view>
            <view
              v-if="index !== schedule.length - 1"
              class="timeline-connector"
            ></view>
          </view>

          <view class="timeline-content">
            <text class="timeline-date">{{ item.date }}</text>
            <view class="timeline-card">
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
  margin-top: 24rpx;
}

.timeline-row {
  display: flex;
  flex-direction: row;
}

.timeline-axis {
  width: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $cr7-gold;
  margin-top: 4rpx;
}

.timeline-connector {
  flex: 1;
  width: 2rpx;
  background: rgba(255, 255, 255, 0.18);
  margin-top: 4rpx;
}

.timeline-content {
  flex: 1;
  padding-bottom: 24rpx;
  padding-left: 8rpx;
}

.timeline-date {
  font-size: $font-xs;
  color: $text-muted;
  letter-spacing: 2rpx;
}

.timeline-card {
  margin-top: 8rpx;
  padding: 16rpx 20rpx;
  border-radius: $radius-lg;
  background: $cr7-card;
  border: 1rpx solid $cr7-border;
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
