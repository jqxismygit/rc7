// 本地存储工具

const STORAGE_KEYS = {
  USER_INFO: 'userInfo',
  TOKEN: 'token',
  IS_EMPLOYEE: 'isEmployee'
}

export default {
  // 保存用户信息
  setUserInfo(userInfo) {
    uni.setStorageSync(STORAGE_KEYS.USER_INFO, userInfo)
  },
  
  // 获取用户信息
  getUserInfo() {
    return uni.getStorageSync(STORAGE_KEYS.USER_INFO) || null
  },
  
  // 保存token
  setToken(token) {
    uni.setStorageSync(STORAGE_KEYS.TOKEN, token)
  },
  
  // 获取token
  getToken() {
    return uni.getStorageSync(STORAGE_KEYS.TOKEN) || ''
  },
  
  // 设置员工身份
  setIsEmployee(isEmployee) {
    uni.setStorageSync(STORAGE_KEYS.IS_EMPLOYEE, isEmployee)
  },
  
  // 获取员工身份
  getIsEmployee() {
    return uni.getStorageSync(STORAGE_KEYS.IS_EMPLOYEE) || false
  },
  
  // 清除所有信息
  clear() {
    uni.clearStorageSync()
  },
  
  // 检查是否登录
  isLoggedIn() {
    return !!this.getToken()
  }
}
