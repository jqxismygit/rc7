<template>
  <view class="game-page">
    <scroll-view scroll-y class="game-scroll">
      <!-- 游戏入口卡片 -->
      <view class="game-card card-dark">
        <view class="game-card-header">
          <text class="game-badge">互动游戏</text>
          <text class="game-title">⚡ 反应力挑战</text>
          <text class="game-desc">测试你的瞬时反应速度，看看能否冲进 CR7 球迷榜单。</text>
        </view>
        <view class="game-card-footer">
          <view class="my-score">
            <text class="my-score-label">我的得分：</text>
            <text class="my-score-value">{{ score || '暂未游戏' }}</text>
          </view>
          <button class="btn-gold start-btn" @click="startGame">
            开始挑战
          </button>
        </view>
      </view>

      <!-- 排行榜 -->
      <view class="ranking-card card-dark">
        <text class="ranking-title">今日排行榜</text>
        <view
          v-for="item in topRanking"
          :key="item.rank"
          class="rank-item"
        >
          <text class="rank-num">{{ item.rank }}</text>
          <image :src="item.avatar" class="rank-avatar" mode="aspectFill" />
          <view class="rank-info">
            <text class="rank-name">{{ item.nickname }}</text>
            <text class="rank-score">{{ item.score }} 分</text>
          </view>
        </view>

        <view class="my-rank">
          <text class="my-rank-text">
            我的排名：
            <text class="my-rank-value">{{ myRanking || '暂未上榜' }}</text>
          </text>
          <text class="my-rank-score">当前记录：{{ score || '暂无成绩' }}</text>
        </view>
      </view>

      <!-- 更多游戏提示 -->
      <view class="placeholder-card card-dark">
        <text class="placeholder-text">更多游戏接入中，敬请期待！</text>
      </view>

      <view class="safe-bottom safe-area-bottom"></view>
    </scroll-view>

    <!-- 游戏交互层 -->
    <view v-if="gameStarted" class="game-overlay">
      <view class="game-screen card-dark">
        <view class="game-header">
          <text class="score-label">得分：{{ score }}</text>
          <text class="time-label">时间：{{ timeLeft }}s</text>
          <view class="game-exit" @click="quitGame">退出</view>
        </view>

        <view class="game-area">
          <view
            v-if="showTarget"
            class="target"
            :style="targetStyle"
            @click="hitTarget"
          >
            ⚽
          </view>
        </view>

        <view class="game-tip">
          <text>{{ gameTip }}</text>
        </view>
      </view>
    </view>

    <!-- 游戏结束弹窗 -->
    <view v-if="gameOver" class="result-modal" @click="closeResult">
      <view class="result-content card-dark" @click.stop>
        <text class="result-title">本次成绩</text>
        <text class="final-score">{{ score }}</text>
        <text class="result-desc">你的反应力得分</text>
        <text class="ranking-text">
          排名：
          <text class="ranking-highlight">
            {{ myRanking ? `第 ${myRanking} 名` : '暂未上榜' }}
          </text>
        </text>
        <button class="btn-gold result-btn" @click="restartGame">
          再玩一次
        </button>
        <button class="outline-btn result-btn" @click="backToHome">
          返回首页
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { mockGameRanking } from '@/utils/mockData.js'
import createTabBarMixin from '@/mixins/tabBar.js'

export default {
  mixins: [createTabBarMixin(2)],
  data() {
    return {
      gameStarted: false,
      gameOver: false,
      score: 0,
      timeLeft: 25,
      showTarget: false,
      targetStyle: {},
      gameTip: '点击绿色区域出现的足球，越快越好！',
      topRanking: [],
      myRanking: null,
      timer: null,
      targetTimer: null
    }
  },

  onLoad() {
    this.loadRanking()
  },

  onUnload() {
    this.clearTimers()
  },

  methods: {
    loadRanking() {
      this.topRanking = mockGameRanking.slice(0, 3)
    },

    startGame() {
      this.clearTimers()
      this.gameStarted = true
      this.gameOver = false
      this.score = 0
      this.timeLeft = 25
      this.gameTip = '准备好，足球即将出现...'
      this.startTimer()
      this.showNextTarget()
    },

    startTimer() {
      this.timer = setInterval(() => {
        this.timeLeft--
        if (this.timeLeft <= 0) {
          this.endGame()
        }
      }, 1000)
    },

    showNextTarget() {
      this.showTarget = false
      const delay = Math.random() * 350 + 250
      this.targetTimer = setTimeout(() => {
        if (this.timeLeft > 0) {
          this.showTarget = true
          this.targetStyle = {
            left: Math.random() * 70 + '%',
            top: Math.random() * 60 + '%'
          }
        }
      }, delay)
    },

    hitTarget() {
      this.score += 100
      this.showTarget = false
      this.gameTip = '干得漂亮！继续保持节奏。'
      this.showNextTarget()
      uni.vibrateShort()
    },

    endGame() {
      this.clearTimers()
      this.gameStarted = false
      this.gameOver = true
      const ranking = mockGameRanking.filter(item => item.score > this.score).length + 1
      this.myRanking = ranking
    },

    clearTimers() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
      if (this.targetTimer) {
        clearTimeout(this.targetTimer)
        this.targetTimer = null
      }
    },

    restartGame() {
      this.startGame()
    },

    quitGame() {
      uni.showModal({
        title: '退出游戏',
        content: '确定退出？当前成绩将不保存',
        success: (res) => {
          if (res.confirm) {
            this.clearTimers()
            this.gameStarted = false
            this.showTarget = false
          }
        }
      })
    },

    closeResult() {
      this.gameOver = false
    },

    backToHome() {
      this.gameOver = false
      uni.switchTab({
        url: '/pages/index/index'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.game-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}

.game-scroll {
  height: 100vh;
  padding: 24rpx 24rpx 0;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.game-card {
  padding: 28rpx 28rpx 24rpx;
  margin-bottom: 24rpx;
}

.game-card-header {
  margin-bottom: 20rpx;
}

.game-badge {
  font-size: $font-xs;
  color: $cr7-gold-light;
  letter-spacing: 2rpx;
}

.game-title {
  margin-top: 8rpx;
  font-size: $font-xl;
  color: $text-white;
  font-weight: 600;
}

.game-desc {
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-light;
}

.game-card-footer {
  margin-top: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.my-score {
  display: flex;
  flex-direction: column;
}

.my-score-label {
  font-size: $font-sm;
  color: $text-light;
}

.my-score-value {
  margin-top: 4rpx;
  font-size: $font-md;
  color: $cr7-gold-light;
}

.start-btn {
  min-width: 220rpx;
  height: 80rpx;
}

.ranking-card {
  padding: 24rpx 24rpx 20rpx;
  margin-bottom: 24rpx;
}

.ranking-title {
  font-size: $font-lg;
  color: $text-white;
  margin-bottom: 16rpx;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
}

.rank-num {
  width: 48rpx;
  font-size: $font-md;
  color: $cr7-gold-light;
  font-weight: 600;
}

.rank-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  margin-right: 16rpx;
}

.rank-info {
  flex: 1;
}

.rank-name {
  font-size: $font-md;
  color: $text-white;
}

.rank-score {
  margin-top: 2rpx;
  font-size: $font-sm;
  color: $text-light;
}

.my-rank {
  margin-top: 20rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid $cr7-border;
}

.my-rank-text {
  font-size: $font-sm;
  color: $text-white;
}

.my-rank-value {
  color: $cr7-gold-light;
}

.my-rank-score {
  margin-top: 4rpx;
  font-size: $font-xs;
  color: $text-muted;
}

.placeholder-card {
  padding: 24rpx;
  margin-bottom: 24rpx;
  align-items: center;
  justify-content: center;
}

.placeholder-text {
  width: 100%;
  text-align: center;
  font-size: $font-sm;
  color: $text-muted;
}

.game-overlay {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-screen {
  width: 680rpx;
  height: 820rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.score-label,
.time-label {
  font-size: $font-md;
  color: $text-white;
  font-weight: 600;
}

.game-exit {
  padding: 8rpx 20rpx;
  font-size: $font-sm;
  color: $text-muted;
  border: 1rpx solid $cr7-border;
  border-radius: 999rpx;
}

.game-area {
  flex: 1;
  position: relative;
  margin: 16rpx;
  border-radius: $radius-md;
  background: rgba(0, 0, 0, 0.4);
}

.target {
  position: absolute;
  font-size: 80rpx;
  animation: pulse 0.5s ease-in-out;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.game-tip {
  margin-top: 12rpx;
  text-align: center;
}

.game-tip text {
  font-size: $font-sm;
  color: $text-light;
}

.result-modal {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 210;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-content {
  width: 600rpx;
  padding: 36rpx 32rpx 28rpx;
  text-align: center;
}

.result-title {
  font-size: $font-lg;
  color: $text-white;
  margin-bottom: 12rpx;
}

.final-score {
  font-size: 72rpx;
  color: $cr7-gold-light;
  font-weight: 800;
  margin-bottom: 4rpx;
}

.result-desc {
  font-size: $font-sm;
  color: $text-light;
  margin-bottom: 8rpx;
}

.ranking-text {
  font-size: $font-sm;
  color: $text-light;
  margin-bottom: 24rpx;
  display: block;
}

.ranking-highlight {
  color: $cr7-gold-light;
}

.result-btn {
  width: 100%;
  height: 80rpx;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.outline-btn {
  background: transparent;
  border-radius: 999rpx;
  border: 1rpx solid $cr7-border;
  color: $text-light;
  font-size: $font-sm;
  line-height: normal;
  display: flex;
  align-items: center;
  justify-content: center;
}

.outline-btn::after {
  border: none;
}

.safe-bottom {
  height: 80rpx;
}
</style>
