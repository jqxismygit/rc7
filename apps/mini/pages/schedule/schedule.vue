<template>
  <view class="container">
    <view class="tabs">
      <view 
        v-for="(tab, index) in tabs" 
        :key="index"
        class="tab-item"
        :class="{ active: currentTab === index }"
        @click="switchTab(index)"
      >
        {{ tab }}
      </view>
    </view>

    <scroll-view class="content" scroll-y>
      <!-- 赛事日程 -->
      <view v-if="currentTab === 0" class="schedule-list">
        <view v-for="match in matches" :key="match.id" class="match-card">
          <view class="match-date">{{ match.date }}</view>
          <view class="match-teams">
            <view class="team">
              <text class="team-name">{{ match.homeTeam }}</text>
              <text v-if="match.homeScore !== null" class="score">{{ match.homeScore }}</text>
            </view>
            <text class="vs">VS</text>
            <view class="team">
              <text v-if="match.awayScore !== null" class="score">{{ match.awayScore }}</text>
              <text class="team-name">{{ match.awayTeam }}</text>
            </view>
          </view>
          <view class="match-info">
            <text class="venue">📍 {{ match.venue }}</text>
            <view class="status" :class="'status-' + match.status">
              {{ getStatusText(match.status) }}
            </view>
          </view>
        </view>
      </view>

      <!-- 积分榜 -->
      <view v-if="currentTab === 1" class="standings-table">
        <view class="table-header">
          <text class="col rank">排名</text>
          <text class="col team">球队</text>
          <text class="col">赛</text>
          <text class="col">胜</text>
          <text class="col">平</text>
          <text class="col">负</text>
          <text class="col points">积分</text>
        </view>
        <view v-for="item in standings" :key="item.rank" class="table-row">
          <text class="col rank">{{ item.rank }}</text>
          <text class="col team">{{ item.team }}</text>
          <text class="col">{{ item.played }}</text>
          <text class="col">{{ item.won }}</text>
          <text class="col">{{ item.drawn }}</text>
          <text class="col">{{ item.lost }}</text>
          <text class="col points">{{ item.points }}</text>
        </view>
      </view>

      <!-- C罗行程 -->
      <view v-if="currentTab === 2" class="timeline">
        <view v-for="item in schedule" :key="item.id" class="timeline-item">
          <view class="timeline-dot"></view>
          <view class="timeline-content">
            <text class="timeline-date">{{ item.date }} {{ item.time }}</text>
            <text class="timeline-event">{{ item.event }}</text>
            <text class="timeline-location">📍 {{ item.location }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { mockMatches, mockStandings, mockSchedule } from '@/utils/mockData.js'

export default {
  data() {
    return {
      tabs: ['赛事日程', '积分榜', 'C罗行程'],
      currentTab: 0,
      matches: [],
      standings: [],
      schedule: []
    }
  },
  
  onLoad() {
    this.loadData()
  },
  
  methods: {
    loadData() {
      this.matches = mockMatches
      this.standings = mockStandings
      this.schedule = mockSchedule
    },
    
    switchTab(index) {
      this.currentTab = index
    },
    
    getStatusText(status) {
      const statusMap = {
        upcoming: '未开始',
        live: '进行中',
        finished: '已结束'
      }
      return statusMap[status] || status
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.tabs {
  display: flex;
  background: #fff;
  padding: 0 30rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 30rpx 0;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.tab-item.active {
  color: #667eea;
  font-weight: bold;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60rpx;
  height: 6rpx;
  background: #667eea;
  border-radius: 3rpx;
}

.content {
  padding: 30rpx;
}

.schedule-list,
.match-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.match-date {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 20rpx;
}

.match-teams {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.team {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.team:last-child {
  flex-direction: row-reverse;
}

.team-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.score {
  font-size: 40rpx;
  font-weight: bold;
  color: #667eea;
}

.vs {
  font-size: 24rpx;
  color: #999;
  margin: 0 20rpx;
}

.match-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.venue {
  font-size: 24rpx;
  color: #666;
}

.status {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.status-upcoming {
  background: #e3f2fd;
  color: #2196f3;
}

.status-live {
  background: #ffebee;
  color: #f44336;
}

.status-finished {
  background: #e0e0e0;
  color: #757575;
}

.standings-table {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.table-header,
.table-row {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
}

.table-header {
  background: #f8f8f8;
  font-weight: bold;
}

.table-row {
  border-bottom: 1px solid #f0f0f0;
}

.table-row:last-child {
  border-bottom: none;
}

.col {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: #333;
}

.col.rank {
  flex: 0.5;
}

.col.team {
  flex: 2;
  text-align: left;
}

.col.points {
  flex: 1;
  font-weight: bold;
  color: #667eea;
}

.timeline {
  position: relative;
  padding-left: 40rpx;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 10rpx;
  top: 0;
  bottom: 0;
  width: 4rpx;
  background: #e0e0e0;
}

.timeline-item {
  position: relative;
  margin-bottom: 40rpx;
}

.timeline-dot {
  position: absolute;
  left: -34rpx;
  top: 10rpx;
  width: 20rpx;
  height: 20rpx;
  background: #667eea;
  border-radius: 50%;
  border: 4rpx solid #fff;
  box-shadow: 0 0 0 4rpx #e0e0e0;
}

.timeline-content {
  background: #fff;
  padding: 30rpx;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.timeline-date {
  font-size: 24rpx;
  color: #999;
}

.timeline-event {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}

.timeline-location {
  font-size: 24rpx;
  color: #666;
}
</style>
