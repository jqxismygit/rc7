# 微信小程序自定义 tabBar（原生四件套）

此目录为微信原生自定义 tabBar，不会被 uni-app 自动拷贝到编译输出。

**每次用 HBuilderX 或 CLI 编译到「微信小程序」后**，请在项目根目录（`apps/mini`）执行：

```bash
node scripts/copy-custom-tab-bar.js
```

否则微信开发者工具会报错：`ENOENT: no such file or directory, open '.../custom-tab-bar/index.json'`。
