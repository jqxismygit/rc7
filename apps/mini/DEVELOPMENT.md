# 开发指南

## 快速开始

### 环境要求

- HBuilderX 3.0+
- 微信开发者工具（用于小程序调试）
- Node.js 14+（可选，用于 CLI 开发）

### 项目启动

1. **使用 HBuilderX**
   - 打开 HBuilderX
   - 文件 -> 打开目录 -> 选择项目根目录
   - 运行 -> 运行到小程序模拟器 -> 微信开发者工具

2. **使用 CLI**（可选）
   ```bash
   # 安装 @dcloudio/cli
   npm install -g @dcloudio/cli
   
   # 运行到微信小程序
   npm run dev:mp-weixin
   
   # 运行到 H5
   npm run dev:h5
   ```

## 项目架构

### 目录结构

```
├── pages/              # 页面
│   ├── index/         # 首页
│   ├── login/         # 登录
│   └── ...            # 其他页面
├── utils/             # 工具类
│   ├── mockData.js   # 假数据
│   └── storage.js    # 存储工具
├── static/            # 静态资源
├── App.vue            # 应用入口
├── main.js            # 主入口
├── pages.json         # 页面配置
└── manifest.json      # 应用配置
```

### 核心文件说明

#### pages.json
页面路由和导航栏配置文件，包含：
- 页面路径配置
- 导航栏样式
- 底部 tabBar 配置
- 全局样式配置

#### manifest.json
应用配置文件，包含：
- 应用基本信息
- 小程序 appid
- 权限配置
- 平台特定配置

#### utils/mockData.js
假数据模块，包含所有页面需要的模拟数据。

#### utils/storage.js
本地存储工具，封装了用户信息、token 等的存储操作。

## 开发规范

### 1. 命名规范

- **文件名**: 使用 kebab-case（短横线命名）
  ```
  event-detail.vue
  ticket-purchase.vue
  ```

- **组件名**: 使用 PascalCase（大驼峰）
  ```javascript
  export default {
    name: 'EventDetail'
  }
  ```

- **变量名**: 使用 camelCase（小驼峰）
  ```javascript
  const userInfo = {}
  const ticketList = []
  ```

### 2. 代码风格

- 使用 2 空格缩进
- 使用单引号
- 语句末尾加分号
- 使用 ES6+ 语法

### 3. 组件结构

```vue
<template>
  <!-- 模板 -->
</template>

<script>
export default {
  data() {
    return {}
  },
  onLoad() {},
  methods: {}
}
</script>

<style scoped>
/* 样式 */
</style>
```

### 4. 样式规范

- 使用 rpx 作为尺寸单位（响应式像素）
- 使用 scoped 避免样式污染
- 使用全局样式变量（uni.scss）
- 遵循 BEM 命名规范

```scss
.card {
  &-header {}
  &-content {}
  &-footer {}
}
```

## 数据流

### 1. 页面数据加载

```javascript
// 在 onLoad 或 onShow 中加载数据
onLoad() {
  this.loadData()
},

methods: {
  loadData() {
    // 从 mockData 导入数据
    import { mockHomeCards } from '@/utils/mockData.js'
    this.cards = mockHomeCards
  }
}
```

### 2. 页面跳转传参

```javascript
// 跳转并传参
uni.navigateTo({
  url: `/pages/detail/detail?id=${id}`
})

// 接收参数
onLoad(options) {
  const id = options.id
}
```

### 3. 本地存储

```javascript
import storage from '@/utils/storage.js'

// 保存数据
storage.setUserInfo(userInfo)

// 读取数据
const userInfo = storage.getUserInfo()

// 清除数据
storage.clear()
```

## 常用 API

### 1. 页面跳转

```javascript
// 保留当前页面，跳转到应用内的某个页面
uni.navigateTo({
  url: '/pages/detail/detail'
})

// 关闭当前页面，跳转到应用内的某个页面
uni.redirectTo({
  url: '/pages/login/login'
})

// 跳转到 tabBar 页面
uni.switchTab({
  url: '/pages/index/index'
})

// 关闭所有页面，打开到应用内的某个页面
uni.reLaunch({
  url: '/pages/login/login'
})

// 返回上一页
uni.navigateBack({
  delta: 1
})
```

### 2. 交互反馈

```javascript
// 显示消息提示框
uni.showToast({
  title: '操作成功',
  icon: 'success',
  duration: 2000
})

// 显示加载提示框
uni.showLoading({
  title: '加载中...'
})
uni.hideLoading()

// 显示模态对话框
uni.showModal({
  title: '提示',
  content: '确定要删除吗？',
  success: (res) => {
    if (res.confirm) {
      // 用户点击确定
    }
  }
})
```

### 3. 本地存储

```javascript
// 同步存储
uni.setStorageSync('key', 'value')
const value = uni.getStorageSync('key')
uni.removeStorageSync('key')
uni.clearStorageSync()

// 异步存储
uni.setStorage({
  key: 'key',
  data: 'value',
  success: () => {}
})
```

### 4. 网络请求

```javascript
uni.request({
  url: 'https://api.example.com/data',
  method: 'GET',
  data: {},
  success: (res) => {
    console.log(res.data)
  },
  fail: (err) => {
    console.error(err)
  }
})
```

## 调试技巧

### 1. 控制台输出

```javascript
console.log('普通日志')
console.warn('警告信息')
console.error('错误信息')
```

### 2. 条件编译

```javascript
// #ifdef MP-WEIXIN
// 仅在微信小程序中编译
console.log('微信小程序')
// #endif

// #ifdef H5
// 仅在 H5 中编译
console.log('H5')
// #endif

// #ifndef MP-WEIXIN
// 除了微信小程序外都编译
console.log('非微信小程序')
// #endif
```

### 3. 真机调试

1. 在 HBuilderX 中点击"运行" -> "运行到手机或模拟器"
2. 使用微信开发者工具的"真机调试"功能
3. 使用 vconsole 进行移动端调试

## 常见问题

### 1. 页面不显示

- 检查 pages.json 中是否配置了页面路径
- 检查页面文件名是否正确
- 检查是否有语法错误

### 2. 样式不生效

- 检查是否使用了 scoped
- 检查选择器优先级
- 检查是否使用了正确的单位（rpx）

### 3. 数据不更新

- 检查是否正确使用了 this.xxx = value
- 检查数据是否是响应式的
- 使用 this.$forceUpdate() 强制更新

### 4. 图片不显示

- 检查图片路径是否正确
- 使用绝对路径 /static/xxx.png
- 检查图片文件是否存在

## 性能优化

### 1. 图片优化

- 使用合适的图片格式（webp）
- 压缩图片大小
- 使用图片懒加载
- 使用 CDN 加速

### 2. 代码优化

- 避免在 onShow 中执行耗时操作
- 使用防抖和节流
- 合理使用缓存
- 减少不必要的渲染

### 3. 包体积优化

- 删除未使用的代码
- 使用分包加载
- 压缩代码
- 优化依赖

## 发布流程

### 1. 微信小程序

1. 在 manifest.json 中配置 appid
2. 在 HBuilderX 中点击"发行" -> "小程序-微信"
3. 上传代码到微信公众平台
4. 提交审核
5. 审核通过后发布

### 2. H5

1. 在 HBuilderX 中点击"发行" -> "网站-H5"
2. 配置域名和路径
3. 上传到服务器

### 3. App

1. 配置证书和签名
2. 在 HBuilderX 中点击"发行" -> "原生App-云打包"
3. 选择平台和打包方式
4. 下载安装包

## 扩展开发

### 添加新页面

1. 在 pages 目录下创建新页面文件夹
2. 创建 xxx.vue 文件
3. 在 pages.json 中添加页面配置
4. 编写页面代码

### 添加新功能

1. 在 utils/mockData.js 中添加假数据
2. 创建对应的页面或组件
3. 实现业务逻辑
4. 测试功能

### 接入真实接口

1. 创建 api 目录
2. 封装请求方法
3. 替换假数据为接口调用
4. 处理错误和异常

## 参考资料

- [uniapp 官方文档](https://uniapp.dcloud.net.cn/)
- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Vue.js 官方文档](https://cn.vuejs.org/)
