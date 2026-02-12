<template>
  <view class="container">
    <view class="logo-section">
      <image src="/static/logo.png" class="logo" mode="aspectFit"></image>
      <text class="app-name">C罗超越之境</text>
      <text class="slogan">与传奇同行</text>
    </view>

    <view class="login-section">
      <button 
        class="login-btn" 
        type="primary"
        @click="handleWechatLogin"
        :loading="loading"
      >
        <text class="btn-icon">📱</text>
        微信一键登录
      </button>
      
      <view class="agreement">
        <checkbox-group @change="handleAgreeChange">
          <label>
            <checkbox :checked="agreed" color="#667eea" />
            <text class="agreement-text">
              我已阅读并同意
              <text class="link" @click.stop="showAgreement('privacy')">《隐私政策》</text>
              和
              <text class="link" @click.stop="showAgreement('service')">《服务协议》</text>
            </text>
          </label>
        </checkbox-group>
      </view>
    </view>
  </view>
</template>

<script>
import { mockUser, mockEmployee } from '@/utils/mockData.js'
import storage from '@/utils/storage.js'

export default {
  data() {
    return {
      agreed: false,
      loading: false
    }
  },
  
  methods: {
    handleAgreeChange(e) {
      this.agreed = e.detail.value.length > 0
    },
    
    handleWechatLogin() {
      if (!this.agreed) {
        uni.showToast({
          title: '请先同意协议',
          icon: 'none'
        })
        return
      }
      
      this.loading = true
      
      // 模拟微信登录
      setTimeout(() => {
        // 随机决定是普通用户还是员工
        const isEmployee = Math.random() > 0.8
        const user = isEmployee ? mockEmployee : mockUser
        
        // 保存用户信息
        storage.setUserInfo(user)
        storage.setToken('mock_token_' + Date.now())
        storage.setIsEmployee(isEmployee)
        
        this.loading = false
        
        uni.showToast({
          title: '登录成功',
          icon: 'success'
        })
        
        setTimeout(() => {
          uni.switchTab({
            url: '/pages/index/index'
          })
        }, 1000)
      }, 1500)
    },
    
    showAgreement(type) {
      const title = type === 'privacy' ? '隐私政策' : '服务协议'
      uni.showModal({
        title: title,
        content: '这里是' + title + '的内容...',
        showCancel: false
      })
    }
  }
}
</script>

<style scoped>
.container {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 60rpx;
}

.logo-section {
  text-align: center;
  margin-bottom: 200rpx;
}

.logo {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 40rpx;
}

.app-name {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 20rpx;
}

.slogan {
  display: block;
  font-size: 28rpx;
  color: rgba(255,255,255,0.8);
}

.login-section {
  width: 100%;
}

.login-btn {
  width: 100%;
  height: 100rpx;
  background: #fff;
  color: #667eea;
  border-radius: 50rpx;
  font-size: 32rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  line-height: 100rpx;
}

.login-btn::after {
  border: none;
}

.btn-icon {
  margin-right: 10rpx;
  font-size: 36rpx;
}

.agreement {
  margin-top: 60rpx;
  color: #fff;
}

.agreement-text {
  font-size: 24rpx;
  color: rgba(255,255,255,0.9);
  margin-left: 10rpx;
}

.link {
  color: #fff;
  text-decoration: underline;
}
</style>
