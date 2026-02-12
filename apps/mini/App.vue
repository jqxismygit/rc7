<script>
export default {
  onLaunch: function() {
    console.log('App Launch')
    
    // 检查登录状态
    const token = uni.getStorageSync('token')
    if (!token) {
      console.log('用户未登录')
    }
  },
  onShow: function() {
    console.log('App Show')
  },
  onHide: function() {
    console.log('App Hide')
  }
}
</script>

<style lang="scss">
@import '@/uni.scss';

/* 全局重置样式 */
page {
  background-color: #f5f5f5;
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}

/* 清除默认样式 */
view, text, image, button {
  box-sizing: border-box;
}

button {
  line-height: normal;
}

button::after {
  border: none;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  display: none;
}

/* 通用动画 */
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.slide-up {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* 通用占位图样式 */
.placeholder-image {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 60rpx;
}
</style>
