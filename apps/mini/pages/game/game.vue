<template>
  <view class="container">
    <view v-if="!gameStarted" class="start-screen">
      <text class="game-title">⚡ 反应力挑战</text>
      <text class="game-desc">测试你的反应速度，看看能否超越C罗！</text>
      
      <view class="ranking-preview">
        <text class="ranking-title">今日排行榜</text>
        <view v-for="item in topRanking" :key="item.rank" class="rank-item">
          <text class="rank">{{ item.rank }}</text>
          <image :src="item.avatar" class="avatar" mode="aspectFill"></image>
          <text class="nickname">{{ item.nickname }}</text>
          <text class="score">{{ item.score }}</text>
        </view>
      </view>
      
      <button class="start-btn" @click="startGame">开始游戏</button>
    </view>

    <view v-else class="game-screen">
      <view class="game-header">
        <text class="score-label">得分：{{ score }}</text>
        <text class="time-label">时间：{{ timeLeft }}s</text>
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

    <!-- 游戏结束弹窗 -->
    <view v-if="gameOver" class="result-modal" @click="closeResult">
      <view class="result-content" @click.stop>
        <text class="result-title">游戏结束</text>
        <text class="final-score">{{ score }}</text>
        <text class="result-desc">你的反应力得分</text>
        <text class="ranking-text">排名：第 {{ myRanking }} 名</text>
        <button class="restart-btn" @click="restartGame">再玩一次</button>
        <button class="back-btn" @click="backToHome">返回首页</button>
      </view>
    </view>
  </view>
</template>

<script>
import { mockGameRanking } from '@/utils/mockData.js'

export default {
  data() {
    return {
      gameStarted: false,
      gameOver: false,
      score: 0,
      timeLeft: 30,
      showTarget: false,
      targetStyle: {},
      gameTip: '准备好了吗？',
      topRanking: [],
      myRanking: 10,
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
      this.gameStarted = true
      this.score = 0
      this.timeLeft = 30
      this.gameTip = '点击足球得分！'
      
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
      
      const delay = Math.random() * 1000 + 500
      this.targetTimer = setTimeout(() => {
        if (this.timeLeft > 0) {
          this.showTarget = true
          this.targetStyle = {
            left: Math.random() * 80 + '%',
            top: Math.random() * 80 + '%'
          }
        }
      }, delay)
    },
    
    hitTarget() {
      this.score += 100
      this.showTarget = false
      this.showNextTarget()
      
      uni.vibrateShort()
    },
    
    endGame() {
      this.clearTimers()
      this.gameOver = true
      this.gameStarted = false
      
      // 计算排名
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
      this.gameOver = false
      this.startGame()
    },
    
    closeResult() {
      this.gameOver = false
    },
    
    backToHome() {
      uni.switchTab({
        url: '/pages/index/index'
      })
    }
  }
}
</script>

<style scoped>
.container {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.start-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 60rpx;
}

.game-title {
  font-size: 60rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 20rpx;
}

.game-desc {
  font-size: 28rpx;
  color: rgba(255,255,255,0.9);
  margin-bottom: 80rpx;
  text-align: center;
}

.ranking-preview {
  width: 100%;
  background: rgba(255,255,255,0.2);
  border-radius: 20rpx;
  padding: 40rpx;
  margin-bottom: 80rpx;
}

.ranking-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 30rpx;
  text-align: center;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  color: #fff;
}

.rank {
  width: 60rpx;
  font-size: 32rpx;
  font-weight: bold;
}

.avatar {
  width: 60rpx;
  height: 60rpx;
  border-radius: 30rpx;
  margin-right: 20rpx;
}

.nickname {
  flex: 1;
  font-size: 28rpx;
}

.score {
  font-size: 28rpx;
  font-weight: bold;
}

.start-btn {
  width: 400rpx;
  height: 100rpx;
  background: #fff;
  color: #667eea;
  border-radius: 50rpx;
  font-size: 32rpx;
  font-weight: bold;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: normal;
}

.start-btn::after {
  border: none;
}

.game-screen {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.game-header {
  display: flex;
  justify-content: space-between;
  padding: 40rpx 60rpx;
  color: #fff;
}

.score-label,
.time-label {
  font-size: 32rpx;
  font-weight: bold;
}

.game-area {
  flex: 1;
  position: relative;
  margin: 0 60rpx;
}

.target {
  position: absolute;
  font-size: 80rpx;
  animation: pulse 0.5s ease-in-out;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.game-tip {
  text-align: center;
  padding: 60rpx;
  color: #fff;
  font-size: 28rpx;
}

.result-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.result-content {
  width: 600rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 60rpx;
  text-align: center;
}

.result-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 30rpx;
}

.final-score {
  font-size: 80rpx;
  font-weight: bold;
  color: #667eea;
  display: block;
  margin-bottom: 10rpx;
}

.result-desc {
  font-size: 28rpx;
  color: #666;
  display: block;
  margin-bottom: 20rpx;
}

.ranking-text {
  font-size: 32rpx;
  color: #ff9800;
  font-weight: bold;
  display: block;
  margin-bottom: 40rpx;
}

.restart-btn,
.back-btn {
  width: 100%;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: normal;
}

.restart-btn::after,
.back-btn::after {
  border: none;
}

.restart-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.back-btn {
  background: #f0f0f0;
  color: #666;
}
</style>
