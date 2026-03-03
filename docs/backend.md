# 项目整体说明

项目整体采用 monorepo 结构，前端和后端代码分开管理，使用 pnpm 进行包管理和构建。
后端采用 Nodejs 和 moleculer 微服务框架，前端采用 React 和 Vite 构建工具。

- ./apps 为前端项目
- ./services 为后端项目

## 后端项目目录结构

后端服务代码

```txt
./services
  /types - rc7 API 相关类型定义
  /rc7
    /config - 配置文件
    /src - 后端服务源代码
      /data - 数据库操作层
      /api.service.ts - API 服务定义
      /user.service.ts - 用户服务定义
      /rc7.service.ts -  rc7 业务逻辑实现
    /tests - 后端服务测试代码
      /features - BDD 测试场景定义
      /steps - 测试步骤定义
      /lib - 测试辅助函数
      /fixtures - 测试数据、方法、断言、mock 等
    /db - 数据库相关文件，如迁移脚本、种子数据等
      / migrations - 数据表迁移脚本
      / bootstrap.ts - 数据表初始化脚本
```

## 后端服务开发规范

- 使用 TypeScript 进行开发，所有代码都需要有类型定义，并且遵循项目的 tsconfig 配置。
- 数据库操作通过 data 层封装，服务层调用 data 提供的方法进行数据访问，避免直接操作数据库。

### 服务层结构

- API 定义在 api.service.ts 中
- 用户相关逻辑放在 user.service.ts 中。
- 业务逻辑实现放在 rc7.service.ts 中

### 类型定义规范

- 所有数据模型类型定义统一放在 services/types 目录
- Request 类型应通过 TypeScript 工具类型基于已有类型组合得出，如 `Omit<Xxx, 'id' | 'created_at' | 'updated_at'>`
- API 文档中的 Request Body 类型说明应明确引用 services/types 中的类型来源和组合方式
- 测试代码应导入并复用 services/types 中定义的类型，避免重复定义
- 不要在 services/types 中创建 Request 类型，如 `CreateXxxRequest`、`UpdateXxxRequest` 等

## 命令工具 rc7

在 /services/rc7/scripts 目录下提供了一个命令行工具 rc7，用于执行一些常用的开发和维护任务，如数据库迁移、数据处理等功能。
入口命令为 `pnpm -w s rc7 <command>`，其中 `<command>` 是 rc7 工具支持的具体命令，如 `migration`、`bootstrap` 等。
一些运维相关的命令也会放在 rc7 工具中，方便运维人员使用。


## 测试

测试采用 BDD 风格，使用 @deepracticex/vitest-cucumber 作为 vitest 的扩展进行测试编写和执行。

### 测试目录结构

- 测试场景定义在 services/rc7/tests/features 目录
- 测试步骤实现放在 services/rc7/tests/steps 目录
- 测试辅助函数放在 services/rc7/tests/lib 目录
- 测试数据和 API 请求以及断言等放在 services/rc7/tests/fixtures 目录

### features

测试场景使用 Gherkin 语法编写，清晰描述测试的 Given、When、Then 步骤。


### 测试执行

测试执行命令：`pnpm -w s test` （在根目录执行，-w s 表示只运行 services 目录下的测试）


## 数据库操作

- 数据库相关文件放在 services/rc7/db 目录
- 数据库操作通过 data 层封装，服务层调用 data 提供的方法进行数据访问，避免直接操作数据库。
- 项目采用 code first 模式，db/下创建数据库定义，然后通过迁移脚本或启动脚本进行数据库表的创建和更新.
- 表结构都定义在 pg schema 下，除非有特例不会在 public schema 下创建表。

### 数据迁移步骤：

1. 在数据库迁移前执行 bootstrap 命令：`pnpm -w s rc7 bootstrap`，此命令会初始化一些必要插件。
2. 创建新的迁移脚本，执行命令 `pnpm -w s rc7 migration create <migration-name>`，会在 services/rc7/db/migrations 目录下生成一个新的迁移脚本文件。
3. 在迁移脚本中定义数据库表的创建、修改或删除操作。
4. 执行迁移命令 `pnpm -w s rc7 migration upgrade`，会执行所有未执行过的迁移脚本，更新数据库表结构。

### SQL 编写规范

- 除了 public schema 下的表，其他 schema 下的表都要加上 schema 前缀，如 `my_schema.my_table`。
- SQL 语句关键字要大写，变量小写。
- 表名、字段名使用下划线分隔，如 user_profile。
- 复杂的 SQL 语句使用多行编写，并且适当缩进以提高可读性。
- 在 SQL 语句中使用参数化查询，避免直接拼接字符串，防止 SQL 注入攻击。
- 尽量用 CTE 将复杂查询拆分为多个步骤，提高可读性和可维护性。
- 不要用存储过程


### data 层方法规范

- 参数中要带上 client 和 schema，避免在服务层直接使用全局数据库连接，增加代码的可测试性和灵活性。
- 方法命名使用动词开头，清晰表达方法的功能，如 getUserById、createProduct 等。
- 压缩方法中的 db query 次数，尽量将多个相关的数据库操作合并为一个 query，减少服务层对数据库的调用次数，提高性能。
