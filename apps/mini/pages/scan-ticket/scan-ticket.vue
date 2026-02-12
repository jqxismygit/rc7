<template>
  <view class="container">
    <view class="scan-area">
      <view class="scan-frame">
        <view class="corner corner-tl"></view>
        <view class="corner corner-tr"></view>
        <view class="corner corner-bl"></view>
        <view class="corner corner-br"></view>
        <view class="scan-line"></view>
      </view>
      <text class="scan-tip">将二维码放入框内，即可自动扫描</text>
    </view>

    <view class="info-section">
      <text class="info-title">扫码验票说明</text>
      <text class="info-text">
        1. 对准票券二维码进行扫描
        2. 系统自动识别并验证票券
        3. 验证成功后票券自动核销
        4. 每张票券仅可核销一次
      </text>
    </view>

    <button class="scan-btn" @click="handleScan">开始扫码</button>

    <!-- 扫描结果弹窗 -->
    <view v-if="showResult" class="result-modal" @click="closeResult">
      <view class="result-content" @click.stop>
        <view class="result-icon" :class="resultSuccess ? 'success' : 'fail'">
          {{ resultSuccess ? '✓' : '✗' }}
        </view>
        <text class="result-title">{{ resultTitle }}</text>
        <text class="result-desc">{{ resultDesc }}</text>
        <button class="close-btn" @click="closeResult">确定</button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      showResult: false,
      resultSuccess: false,
      resultTitle: '',
      resultDesc: ''
    }
  },
  
  methods: {
    handleScan() {
      // 模拟扫码
      uni.showLoading({ title: '扫描中...' })
      
      setTimeout(() => {
        uni.hideLoading()
        
        // 随机模拟成功或失败
        const success = Math.random() > 0.3
        
        this.resultSuccess = success
        this.resultTitle = success ? '验票成功' : '验票失败'
        this.resultDesc = success 
          ? '票券已核销，请入场' 
          : '票券无效或已使用'
        this.showResult = true
      }, 1500)
    },
    
    closeResult() {
      this.showResult = false
    }
  }
}
</script>

<style scoped>
.container {
  width: 100%;
  min-height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 30rpx;
}

.scan-area {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.scan-frame {
  width: 500rpx;
  height: 500rpx;
  position: relative;
  margin-bottom: 40rpx;
}

.corner {
  position: absolute;
  width: 60rpx;
  height: 60rpx;
  border: 6rpx solid #667eea;
}

.corner-tl {
  top: 0;
  left: 0;
  border-right: none;
  border-bottom: none;
}

.corner-tr {
  top: 0;
  right: 0;
  border-left: none;
  border-bottom: none;
}

.corner-bl {
  bottom: 0;
  left: 0;
  border-right: none;
  border-top: none;
}

.corner-br {
  bottom: 0;
  right: 0;
  border-left: none;
  border-top: none;
}

.scan-line {
  position: absolute;
  width: 100%;
  height: 4rpx;
  background: linear-gradient(90deg, transparent, #667eea, transparent);
  animation: scan 2s linear infinite;
}

@keyframes scan {
  0% {
    top: 0;
  }
  100% {
    top: 100%;
  }
}

.scan-tip {
  font-size: 28rpx;
  color: #fff;
  text-align: center;
}

.info-section {
  background: rgba(255,255,255,0.1);
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 60rpx;
}

.info-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 20rpx;
}

.info-text {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
  line-height: 1.8;
  white-space: pre-line;
}

.scan-btn {
  width: 500rpx;
  height: 90rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 45rpx;
  font-size: 32rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: normal;
}

.scan-btn::after {
  border: none;
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

.result-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 80rpx;
  color: #fff;
  margin: 0 auto 30rpx;
}

.result-icon.success {
  background: #4caf50;
}

.result-icon.fail {
  background: #f44336;
}

.result-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.result-desc {
  font-size: 28rpx;
  color: #666;
  display: block;
  margin-bottom: 40rpx;
}

.close-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: normal;
}

.close-btn::after {
  border: none;
}
</style>
