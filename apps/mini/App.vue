<script>
export default {
  onLaunch: function() {
    console.log('App Launch')
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

/* 全局重置 — CR7® LIFE 暗金运动风 */
page {
  background-color: $cr7-black;
  font-size: 28rpx;
  color: $text-white;
  line-height: 1.6;
  font-family: 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
}

view, text, image, button, scroll-view {
  box-sizing: border-box;
}

button {
  line-height: normal;
}

button::after {
  border: none;
}

::-webkit-scrollbar {
  display: none;
}

/* 通用动画 */
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.slide-up {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* 遮罩弹窗背景 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-box {
  width: 600rpx;
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  padding: $spacing-xl;
}
</style>
