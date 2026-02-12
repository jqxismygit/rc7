<template>
  <view class="container">
    <scroll-view class="content" scroll-y>
      <view v-for="vote in votes" :key="vote.matchId" class="vote-card">
        <view class="match-info">
          <text class="team">{{ vote.homeTeam }}</text>
          <text class="vs">VS</text>
          <text class="team">{{ vote.awayTeam }}</text>
        </view>

        <view class="vote-options">
          <view 
            class="vote-option"
            :class="{ active: vote.userVote === 'home' }"
            @click="handleVote(vote, 'home')"
          >
            <text class="option-text">主胜</text>
            <text class="vote-count">{{ vote.homeVotes }}</text>
            <view class="progress-bar">
              <view 
                class="progress" 
                :style="{ width: getVotePercent(vote, 'home') + '%' }"
              ></view>
            </view>
          </view>

          <view 
            class="vote-option"
            :class="{ active: vote.userVote === 'draw' }"
            @click="handleVote(vote, 'draw')"
          >
            <text class="option-text">平局</text>
            <text class="vote-count">{{ vote.drawVotes }}</text>
            <view class="progress-bar">
              <view 
                class="progress" 
                :style="{ width: getVotePercent(vote, 'draw') + '%' }"
              ></view>
            </view>
          </view>

          <view 
            class="vote-option"
            :class="{ active: vote.userVote === 'away' }"
            @click="handleVote(vote, 'away')"
          >
            <text class="option-text">客胜</text>
            <text class="vote-count">{{ vote.awayVotes }}</text>
            <view class="progress-bar">
              <view 
                class="progress" 
                :style="{ width: getVotePercent(vote, 'away') + '%' }"
              ></view>
            </view>
          </view>
        </view>

        <text class="total-votes">总投票数：{{ getTotalVotes(vote) }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { mockVoteOptions } from '@/utils/mockData.js'

export default {
  data() {
    return {
      votes: []
    }
  },
  
  onLoad() {
    this.loadVotes()
  },
  
  methods: {
    loadVotes() {
      this.votes = mockVoteOptions
    },
    
    getTotalVotes(vote) {
      return vote.homeVotes + vote.awayVotes + vote.drawVotes
    },
    
    getVotePercent(vote, type) {
      const total = this.getTotalVotes(vote)
      if (total === 0) return 0
      
      let count = 0
      if (type === 'home') count = vote.homeVotes
      else if (type === 'away') count = vote.awayVotes
      else count = vote.drawVotes
      
      return Math.round((count / total) * 100)
    },
    
    handleVote(vote, type) {
      if (vote.userVote) {
        uni.showToast({
          title: '您已投过票了',
          icon: 'none'
        })
        return
      }
      
      uni.showModal({
        title: '确认投票',
        content: `确定投票给"${this.getVoteText(type)}"吗？`,
        success: (res) => {
          if (res.confirm) {
            vote.userVote = type
            
            if (type === 'home') vote.homeVotes++
            else if (type === 'away') vote.awayVotes++
            else vote.drawVotes++
            
            uni.showToast({
              title: '投票成功',
              icon: 'success'
            })
          }
        }
      })
    },
    
    getVoteText(type) {
      const textMap = {
        home: '主胜',
        away: '客胜',
        draw: '平局'
      }
      return textMap[type]
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.content {
  padding: 30rpx;
}

.vote-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
  margin-bottom: 30rpx;
}

.match-info {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40rpx;
}

.team {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.vs {
  font-size: 24rpx;
  color: #999;
  margin: 0 30rpx;
}

.vote-options {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.vote-option {
  padding: 30rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  border: 2rpx solid transparent;
}

.vote-option.active {
  background: #f5f7ff;
  border-color: #667eea;
}

.option-text {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  display: block;
  margin-bottom: 10rpx;
}

.vote-count {
  font-size: 24rpx;
  color: #666;
  display: block;
  margin-bottom: 15rpx;
}

.progress-bar {
  width: 100%;
  height: 8rpx;
  background: #e0e0e0;
  border-radius: 4rpx;
  overflow: hidden;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s;
}

.total-votes {
  font-size: 24rpx;
  color: #999;
  text-align: center;
  display: block;
}
</style>
