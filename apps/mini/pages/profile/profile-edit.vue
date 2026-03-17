<template>
  <view class="profile-edit-page">
    <view class="card-dark info-card">
      <!-- 头像：可修改，点击弹出操作选单 -->
      <view class="cell cell-avatar" @click="openAvatarActionSheet">
        <text class="cell-label">头像</text>
        <view class="cell-value">
          <image
            :src="form.avatar || defaultAvatar"
            class="avatar"
            mode="aspectFill"
          />
          <text class="cell-arrow">›</text>
        </view>
      </view>

      <!-- 昵称：点击行编辑，可一键用微信昵称 -->
      <view class="cell" @click="openEdit('nickname')">
        <text class="cell-label">昵称</text>
        <view class="cell-value">
          <text class="cell-text">
            {{ form.nickname || '去设置昵称' }}
          </text>
          <text class="cell-link" @click.stop="useWechatNickname">
            用微信昵称
          </text>
          <text class="cell-arrow">›</text>
        </view>
      </view>

      <!-- 邮箱：点击行编辑 -->
      <view class="cell" @click="openEdit('email')">
        <text class="cell-label">邮箱</text>
        <view class="cell-value">
          <text class="cell-text">
            {{ form.email || '用于接收电子发票等通知' }}
          </text>
          <text class="cell-arrow">›</text>
        </view>
      </view>

      <!-- 手机号：只读 -->
      <view class="cell cell-readonly">
        <text class="cell-label">手机号</text>
        <view class="cell-value">
          <text class="cell-text">
            {{ form.phone || '当前登录手机号' }}
          </text>
        </view>
      </view>
      <view class="cell-tip">
        由微信一键登录获取，不支持修改
      </view>
    </view>

    <view class="footer">
      <button class="btn-gold save-btn" :loading="saving" @click="handleSave">
        保存
      </button>
    </view>
  </view>
</template>

<script>
import { useUserStore } from '@/stores/user'

export default {
  data() {
    return {
      form: {
        avatar: '',
        nickname: '',
        email: '',
        phone: ''
      },
      saving: false,
      defaultAvatar: 'https://via.placeholder.com/100'
    }
  },

  onShow() {
    this.initForm()
  },

  methods: {
    initForm() {
      const userStore = useUserStore()
      const userInfo = userStore.profile || {}
      this.form.avatar = userInfo.avatar || ''
      this.form.nickname = userInfo.nickname || ''
      this.form.email = userInfo.email || ''
      this.form.phone = userInfo.phone || ''
    },

    openAvatarActionSheet() {
      const itemList = ['用微信头像', '从相册选择', '拍照']
      uni.showActionSheet({
        itemList,
        success: (res) => {
          const index = res.tapIndex
          if (index === 0) {
            this.useWechatAvatar()
          } else if (index === 1) {
            this.chooseFromAlbum()
          } else if (index === 2) {
            this.takePhoto()
          }
        }
      })
    },

    useWechatAvatar() {
      // #ifdef MP-WEIXIN
      if (wx && wx.getUserProfile) {
        wx.getUserProfile({
          desc: '用于完善个人头像和昵称',
          success: (res) => {
            const avatar = res?.userInfo?.avatarUrl
            if (avatar) {
              this.form.avatar = avatar
            }
            // 如果当前没有昵称，也顺便带一下微信昵称（截断16字）
            if (!this.form.nickname && res?.userInfo?.nickName) {
              this.form.nickname = res.userInfo.nickName.slice(0, 16)
            }
          },
          fail: () => {
            uni.showToast({
              title: '获取微信头像失败',
              icon: 'none'
            })
          }
        })
        return
      }
      // #endif
      uni.showToast({
        title: '当前环境不支持获取微信头像',
        icon: 'none'
      })
    },

    useWechatNickname() {
      // #ifdef MP-WEIXIN
      if (wx && wx.getUserProfile) {
        wx.getUserProfile({
          desc: '用于完善个人昵称',
          success: (res) => {
            const nick = res?.userInfo?.nickName
            if (nick) {
              const v = nick.slice(0, 16)
              this.form.nickname = v
              uni.showToast({
                title: '已同步微信昵称',
                icon: 'success'
              })
            }
          },
          fail: () => {
            uni.showToast({
              title: '获取微信昵称失败',
              icon: 'none'
            })
          }
        })
        return
      }
      // #endif
      uni.showToast({
        title: '当前环境不支持获取微信昵称',
        icon: 'none'
      })
    },

    chooseFromAlbum() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album'],
        success: (res) => {
          const path = (res.tempFilePaths && res.tempFilePaths[0]) || ''
          if (path) {
            this.form.avatar = path
          }
        },
        fail: () => {
          uni.showToast({
            title: '从相册选择失败',
            icon: 'none'
          })
        }
      })
    },

    takePhoto() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['camera'],
        success: (res) => {
          const path = (res.tempFilePaths && res.tempFilePaths[0]) || ''
          if (path) {
            this.form.avatar = path
          }
        },
        fail: () => {
          uni.showToast({
            title: '拍照失败',
            icon: 'none'
          })
        }
      })
    },

    openEdit(field) {
      const isNickname = field === 'nickname'
      const title = isNickname ? '修改昵称' : '修改邮箱'
      const placeholder = isNickname
        ? '最多16个字，建议使用易于识别的称呼'
        : '请输入常用邮箱地址'
      const current = isNickname ? this.form.nickname : this.form.email

      uni.showModal({
        title,
        content: current || '',
        editable: true,
        placeholderText: placeholder,
        success: (res) => {
          if (!res.confirm) return
          const value = (res.content || '').trim()
          if (isNickname) {
            if (!value) {
              uni.showToast({
                title: '昵称不能为空',
                icon: 'none'
              })
              return
            }
            const v = value.slice(0, 16)
            this.form.nickname = v
          } else {
            if (!this.validateEmail(value)) {
              uni.showToast({
                title: '邮箱格式不正确',
                icon: 'none'
              })
              return
            }
            this.form.email = value
          }
        }
      })
    },

    validateEmail(email) {
      if (!email) return true
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return pattern.test(email)
    },

    async handleSave() {
      if (!this.form.nickname) {
        uni.showToast({
          title: '请填写昵称',
          icon: 'none'
        })
        return
      }
      if (this.form.nickname.length > 16) {
        this.form.nickname = this.form.nickname.slice(0, 16)
      }

      if (!this.validateEmail(this.form.email)) {
        uni.showToast({
          title: '邮箱格式不正确',
          icon: 'none'
        })
        return
      }

      this.saving = true
      try {
        const userStore = useUserStore()
        const userInfo = userStore.profile || {}
        const newUserInfo = {
          ...userInfo,
          avatar: this.form.avatar || userInfo.avatar,
          nickname: this.form.nickname,
          email: this.form.email
        }
        userStore.setProfile(newUserInfo)
        uni.showToast({
          title: '已保存',
          icon: 'success'
        })
        setTimeout(() => {
          uni.navigateBack()
        }, 500)
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.profile-edit-page {
  min-height: 100vh;
  background: $cr7-black;
  padding: 24rpx 24rpx 40rpx;
  box-sizing: border-box;
}

.info-card {
  padding: 0;
}

.card-dark {
  background: $cr7-card;
  border-radius: $radius-lg;
  border: 1rpx solid $cr7-border;
  box-shadow: $shadow-card;
}

.cell {
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid $cr7-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cell-avatar {
  .cell-value {
    justify-content: flex-end;
  }
}

.cell-readonly .cell-text {
  color: $text-light;
}

.cell-label {
  font-size: $font-md;
  color: $text-white;
}

.cell-value {
  flex: 1;
  margin-left: 32rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
}

.cell-text {
  max-width: 380rpx;
  text-align: right;
  font-size: $font-md;
  color: $text-white;
}

.cell-link {
  font-size: $font-xs;
  color: $cr7-gold-light;
}

.cell-arrow {
  font-size: 32rpx;
  color: $text-muted;
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(216, 252, 15, 0.6);
}

.cell-tip {
  padding: 12rpx 24rpx 20rpx;
  font-size: $font-xs;
  color: $text-muted;
}

.footer {
  margin-top: 32rpx;
}

.save-btn {
  width: 100%;
  height: 88rpx;
}

.save-btn::after {
  border: none;
}
</style>

