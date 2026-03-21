# User 设计

本文档描述 user 模块的接口设计、数据库设计和数据结构设计。

## 1. 目标与边界

### 1.1 目标

- 保持 `users` 作为唯一用户主体。
- 支持一个用户绑定多种认证方式，而不是为管理员和微信用户拆两套账号体系。
- 手机号作为用户身份标识的一种，独立建表，与 `users` 主表解耦，便于后续扩展手机验证码登录等认证方式。
- `role` 作为用户的附加属性独立建模，不放在 `users` 主表中。
- 当前先设计两种认证方式：
  - 微信小程序登录
  - 手机号密码登录
- 管理员账号通过 CLI 初始化，本质上仍然是普通 `users` 记录，只是额外绑定 `ADMIN` 角色。

### 1.2 非目标

- 本轮不实现真实后端逻辑。
- 本轮不设计短信、邮箱验证码等其他认证方式。
- 本轮不引入复杂 RBAC，仅保留单字段角色模型满足当前 feature。

## 2. 领域模型

### 2.1 用户主体

`users` 表表示系统内的“人”。

核心字段：
- `id: UUID`
- `name: string`
- `created_at`
- `updated_at`

说明：
- 无论用户从微信登录，还是通过用户名密码登录，最终都归属于同一条 `users` 记录。
- `users` 主表不存手机号，手机号独立到 `user_phone` 表，与其他认证方式保持对称。
- `users` 主表也不存 `role`，角色通过独立表维护。
- 后续若微信用户补绑密码，不新建用户，只新增对应认证记录。

### 2.2 角色

新增 `roles` 表与 `user_roles` 关系表，表示用户拥有的附加角色。

`roles` 核心字段：
- `id: UUID`
- `name: string`

`user_roles` 核心字段：
- `uid: UUID` -> `users.id`
- `role_id: UUID` -> `roles.id`

说明：
- 一个用户可以拥有多个角色。
- 当前角色不承载权限明细，权限判断先直接依赖 `roles.name`。
- 例如系统管理员通过绑定 `ADMIN` 角色来识别。

### 2.3 微信认证方式

`user_wechat` 表表示微信小程序身份绑定。

核心字段：
- `uid: UUID` -> `users.id`
- `appid: string`
- `openid: string`
- `session_key: string`
- `created_at`
- `updated_at`

说明：
- `(appid, openid)` 全局唯一。
- 一个用户当前只设计绑定一个微信小程序身份；若未来需要支持多 appid，可继续复用这张表。

### 2.4 手机号绑定

新增 `user_phone` 表，表示用户绑定的手机号。

核心字段：
- `uid: UUID` -> `users.id`
- `country_code: string`（默认 `+86`）
- `phone: string`（本地号码，如 `12345678901`）
- `created_at`
- `updated_at`

说明：
- `(country_code, phone)` 全局唯一。
- 手机号独立建表是为了和其他认证方式对称，且便于后续扩展手机验证码登录。
- 当前系统管理员初始化时必须绑定手机号；普通用户可后续绑定。
- CLI 初始化时只需提供本地号码，国别码默认 `+86`，由系统补全。

### 2.5 密码认证方式

新增 `user_password` 表，表示用户可使用手机号密码登录。

核心字段：
- `uid: UUID` -> `users.id`
- `pass_hash: string`
- `created_at`
- `updated_at`

说明：
- `uid` 唯一，表示一个用户最多维护一套当前密码。
- 登录标识由 `user_phone` 提供，`user_password` 仅负责保存密码哈希。
- 后续微信用户设置密码时，只需向这张表插入一条记录或更新密码，不需要迁移用户主体。

## 3. 数据库设计

### 3.1 users

建议结构：

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.2 roles

建议新增：

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  name VARCHAR(64) NOT NULL UNIQUE
);
```

约束与说明：
- 当前角色表只保留 `id` 和 `name`
- 权限设计暂不展开，后续如需细化再增加权限模型

### 3.3 user_roles

建议新增：

```sql
CREATE TABLE user_roles (
  uid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (uid, role_id)
);
```

约束与说明：
- 一个用户可绑定多个角色
- 一个角色可被多个用户复用
- 当前业务侧按 `roles.name` 判断权限

### 3.4 user_wechat

沿用现有表，建议保持：

```sql
CREATE TABLE user_wechat (
  uid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appid VARCHAR(255) NOT NULL,
  openid VARCHAR(255) NOT NULL,
  session_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (appid, openid)
);
```

索引建议：
- `CREATE UNIQUE INDEX idx_user_wechat_uid ON user_wechat(uid);`

### 3.5 user_phone

建议新增：

```sql
CREATE TABLE user_phone (
  uid UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  country_code VARCHAR(8) NOT NULL DEFAULT '+86',
  phone VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, phone)
);
```

约束与说明：
- `uid` 主键：一个用户目前绑定一个手机号
- `(country_code, phone)` 唯一：保证手机号不重复注册
- 国别码默认 `+86`，由系统在写入前补全，不依赖调用方
- 查找时可按 `(country_code, phone)` 组合定位用户

### 3.6 user_password

建议新增：

```sql
CREATE TABLE user_password (
  uid UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pass_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

约束与说明：
- `uid` 主键：一个用户只保留一套当前密码
- `pass_hash` 存哈希，不存明文

## 4. 数据结构设计

共享类型建议统一放在 `services/types/user.ts`：

- `Role`
- `AuthMethodType = 'WECHAT_MINI' | 'PASSWORD'`
- `User.Profile`
- `User.PasswordCredential`

推荐响应结构：

```ts
interface Profile {
  id: string;
  name: string;
  roles: Array<{ id: string; name: string }>;
  phone: string | null;       // 完整号码，如 "+86 12345678901"，来自 user_phone
  openid: string | null;      // 来自 user_wechat
  auth_methods: Array<'WECHAT_MINI' | 'PASSWORD'>;
  created_at: string;
  updated_at: string;
}
```

说明：
- `phone`、`openid` 均来自各自独立的关联表，允许为 `null`。
- `phone` 在返回时由 `country_code` 和 `phone` 拼合为完整格式，如 `+86 12345678901`。
- `roles` 来自 `roles + user_roles` 聚合结果；当前只通过 `name` 判定权限。
- `auth_methods` 由服务层聚合生成，不要求每张表单独保存该字段。

## 5. 接口设计

### 5.1 微信小程序登录

- `POST /user/login/wechat/mini`
- 入参：`{ code: string }`
- 返回：`{ token: string }`

流程：
1. 调微信接口换取 `openid`
2. 查找 `(appid, openid)` 对应的 `user_wechat`
3. 若不存在，则创建 `users` 与 `user_wechat`
4. 若存在，则更新 `session_key`
5. 返回 JWT

### 5.2 手机号密码登录

- `POST /user/login/password`
- 入参：`{ country_code: string; phone: string; password: string }`
- 返回：`{ token: string }`

流程：
1. 根据 `(country_code, phone)` 查找 `user_phone` 关联用户
2. 根据 `uid` 读取 `user_password`
3. 校验密码哈希
4. 返回 JWT

说明：
- `country_code` 默认可取 `+86`
- 管理员初始化场景下，手机号默认来自 CLI 入参

### 5.3 初始化管理员账号

- CLI：`pnpm -w s cr7 user init-admin --phone 12345678901 --password "pass_test"`

流程：
1. 接收本地手机号，国别码默认 `+86`，系统自动补全
2. 校验 `(country_code, phone)` 是否已存在于 `user_phone`
3. 创建 `users(name = 'system admin')`
4. 创建 `user_phone(country_code = '+86', phone = <phone>)`
5. 绑定 `ADMIN` 角色
6. 创建 `user_password`
7. 输出创建结果

### 5.4 修改密码

- `PUT /user/password`
- 入参：`{ current_password: string; new_password: string }`
- 返回：`204 No Content`

流程：
1. 从 token 识别当前用户
2. 读取该用户的 `user_password`
3. 校验 `current_password`
4. 更新 `pass_hash`

### 5.5 获取当前用户信息

- `GET /user/profile`
- 返回：`User.Profile`

聚合逻辑：
- 主体字段来自 `users`
- `roles` 来自 `roles + user_roles`
- `phone` 来自 `user_phone`，拼合 `country_code + ' ' + phone`
- `openid` 来自 `user_wechat`
- `auth_methods` 根据关联表是否存在动态生成

## 6. 错误设计

建议错误码：

- `USER_NOT_FOUND`
- `ROLE_NOT_FOUND`
- `USER_PASSWORD_NOT_FOUND`
- `PHONE_ALREADY_EXISTS`
- `PHONE_NOT_FOUND`
- `INVALID_PHONE_OR_PASSWORD`
- `PASSWORD_MISMATCH`
- `USER_AUTH_METHOD_NOT_BOUND`

建议状态码：

- `400 Bad Request`：参数不合法
- `401 Unauthorized`：认证失败、密码错误
- `404 Not Found`：用户不存在或未绑定密码
- `409 Conflict`：手机号冲突

## 7. Data 层建议

建议在 `services/cr7/src/data/user.ts` 中补充以下方法：

- `createWechatUser(client, schema, input)`
- `getRoleByName(client, schema, name)`
- `assignRoleToUser(client, schema, uid, roleId)`
- `getUserByWechatOpenid(client, schema, appid, openid)`
- `upsertWechatSession(client, schema, input)`
- `createAdminUser(client, schema, input)`
- `createPhoneBinding(client, schema, uid, countryCode, phone)`
- `getUserByPhone(client, schema, countryCode, phone)`
- `createPasswordCredential(client, schema, input)`
- `getPasswordCredentialByUid(client, schema, uid)`
- `updatePasswordCredential(client, schema, uid, pass_hash)`
- `getUserProfile(client, schema, uid)`

设计原则：
- `users`、`roles`、`user_roles`、`user_wechat`、`user_password` 分开建模
- join 聚合放在 service 层或 profile 查询中统一处理
- 所有方法都显式传入 `client` 和 `schema`

## 8. Spec 设计

对应 feature 的测试分层建议如下：

### 8.1 已存在场景

- 微信首次登录自动注册
- 微信再次登录复用已有用户

### 8.2 待补场景

- CLI 初始化管理员账号成功
- 管理员初始化时写入手机号，国别码自动补全为 `+86`
- 管理员初始化后名称默认为 `system admin`
- 管理员使用手机号密码登录成功
- 管理员修改密码成功
- 新密码可登录，旧密码失效

### 8.3 推荐 fixture

- `runCr7Command(args)`：执行 CLI
- `passwordLogin(apiServer, countryCode, phone, password)`：调用密码登录接口
- `changePassword(apiServer, token, currentPassword, newPassword)`：调用修改密码接口
- `assertAdminProfile(profile)`：断言管理员 profile

### 8.4 本轮结论

- 先补 spec 骨架与设计说明，不要求当前可执行通过
- 等后端接口和 CLI 实现落地后，再把 todo 场景替换为正式步骤定义