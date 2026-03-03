# 这个目录存放 API 请求服务（含 mock 实现）

统一约定：**页面不要直接写死静态数据或直接引 `mockData.js`**，而是通过这里的服务函数拿数据。  
这样后续从 mock 切到真实后端，只需要在 `services` 里换实现。

## 使用方式

1. 在 `services` 下按业务模块拆文件，例如：
   - `messages.js`：消息中心相关接口
   - `home.js`：首页相关接口（Banner、联名品牌等）
   - 后续可以新增 `tickets.js`、`events.js` 等

2. 页面中通过服务拿数据（以消息为例）：

```js
// pages/index/index.vue
import { fetchUnreadCount } from '@/services/messages.js'

export default {
  async onShow() {
    this.unreadCount = await fetchUnreadCount()
  }
}
```

3. mock 服务实现约定：
   - 从 `@/utils/mockData.js` 读取假数据
   - 返回 `Promise`，内部用 `setTimeout` 模拟网络延迟
   - 不在页面内直接使用静态常量

后续接真接口时，只需要在这些服务文件中，改成使用 `@/utils/request.js` 调用后端即可。
