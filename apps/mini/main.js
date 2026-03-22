import App from './App'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import createPersistPlugin from '@/utils/createPersistPlugin.js'
import { createEventBus } from '@/utils/eventBus.js'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()

  // 极薄持久化插件：当前只持久化 user store
  pinia.use(createPersistPlugin({ ids: ['user'] }))

  app.use(pinia)
  app.config.globalProperties.$bus = createEventBus()
  return {
    app
  }
}
// #endif