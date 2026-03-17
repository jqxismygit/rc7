const persistStorage = {
  getItem(key) {
    try {
      return uni.getStorageSync(key)
    } catch (e) {
      return null
    }
  },
  setItem(key, value) {
    try {
      uni.setStorageSync(key, value)
    } catch (e) {}
  },
  removeItem(key) {
    try {
      uni.removeStorageSync(key)
    } catch (e) {}
  }
}

export default persistStorage

