import persistStorage from '@/utils/persistStorage.js'

/**
 * 创建一个极薄的 Pinia 持久化插件
 * - 目前只对指定 id 的 store 做持久化（默认 ['user']）
 * - 底层使用 uni 存储（见 persistStorage）
 */
export default function createPersistPlugin(options = {}) {
  const ids = options.ids || ['user']

  return ({ store }) => {
    if (!ids.includes(store.$id)) return

    const key = store.$id
    const raw = persistStorage.getItem(key)

    if (raw) {
      try {
        const state = typeof raw === 'string' ? JSON.parse(raw) : raw
        store.$patch(state)
      } catch (e) {
        // 忽略非法数据
      }
    }

    store.$subscribe((_mutation, state) => {
      try {
        persistStorage.setItem(key, JSON.stringify(state))
      } catch (e) {
        // 忽略写入异常
      }
    })
  }
}

