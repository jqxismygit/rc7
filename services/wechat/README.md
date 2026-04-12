# WeChat Service

独立的微信 Access Token 服务 package，仅处理 token 刷新与缓存。

## 功能特性

- 无外部依赖，使用 Node.js 内置 http/https 模块
- 单文件实现，轻量级设计
- 启动时检查 token 是否过期
- Access Token 自动缓存与过期检查
- Settings 文件持久化存储配置和 token
- 环境变量控制服务端口和设置文件路径

## 目录说明

```
services/wechat/
├── src/
│   └── index.ts           # 主要服务文件
├── package.json
├── tsconfig.json
├── wechat-settings.json.example  # 配置文件示例
└── README.md
```

## 配置

### 环境变量

- `WECHAT_PORT` - HTTP 服务监听端口（默认：3000）
- `WECHAT_SETTINGS_PATH` - Settings 文件路径（默认：当前目录的 `wechat-settings.json`）

### Settings 文件

复制 `wechat-settings.json.example` 为 `wechat-settings.json`，填入你的微信配置：

```json
{
  "wechat": {
    "base_url": "https://api.weixin.qq.com",
    "appid": "your_appid_here",
    "secret": "your_secret_here"
  }
}
```

启动时，服务会自动检查 access token 是否过期。每次获取新的 token 时，都会自动写回到 settings 文件中。

## API 端点

### 健康检查
```
GET /health
```

### 获取 Access Token
```
GET /access_token
```

响应示例：
```json
{
  "access_token": "xxx",
  "expires_in": 7200
}
```

`/access_token` 会在缓存有效时直接返回缓存；缓存缺失或过期时刷新并写回 settings 文件。

## 使用

### 开发模式

```bash
# 使用 tsx 直接运行
WECHAT_PORT=3000 tsx src/index.ts
```

### 生产模式

```bash
# 构建
pnpm build

# 运行
WECHAT_PORT=3000 node dist/index.js
```

## 错误处理

服务会捕获微信 API 返回的错误并以以下格式响应：

```json
{
  "errcode": 40001,
  "errmsg": "invalid credential"
}
```
