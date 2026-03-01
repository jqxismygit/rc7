# 项目整体说明

项目整体采用 monorepo 结构，前端和后端代码分开管理，使用 pnpm 进行包管理和构建。
后端采用 Nodejs 和 moleculer 微服务框架，前端采用 React 和 Vite 构建工具。

- ./apps 为前端项目
- ./services 为后端项目

### 后端项目目录结构

后端服务代码

```txt
./services
  /types - rc7 API 相关类型定义
  /rc7
    /config - 配置文件
    /src - 后端服务源代码
      /models - 数据库操作层
      /api.service.ts - API 服务定义
      /user.service.ts - 用户服务定义
      /rc7.service.ts -  rc7 业务逻辑实现
    /tests - 后端服务测试代码
      /features - BDD 测试场景定义
      /steps - 测试步骤定义
      /lib - 测试辅助函数
      /fixtures - 测试数据、方法、断言、mock 等
```

### 后端服务开发规范

- 数据库操作通过 models 层封装，服务层调用 models 提供的方法进行数据访问，避免直接操作数据库。
- API 定义在 api.service.ts 中，业务逻辑实现放在 rc7.service.ts 中，用户相关逻辑放在 user.service.ts 中。
- 测试代码采用 BDD 风格，测试场景定义在 features 目录，测试步骤实现放在 steps 目录，测试辅助函数放在 lib 目录，测试数据和断言等放在 fixtures 目录。
- 使用 TypeScript 进行开发，所有代码都需要有类型定义，并且遵循项目的 tsconfig 配置。