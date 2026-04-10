# 用户相关接口

基于 `User` 类型（来自 `@cr7/types`）定义。

## 设计目标

- `users` 作为统一用户实体，支持一个用户绑定多种登录方式。
- 管理员账号只是绑定了 `ADMIN` 角色的普通用户，不单独拆出另一套账号体系。

## 微信小程序登录/注册

- URL: `/user/login/wechat/mini`
- Method: `POST`
- Request Body:
  ```ts
  { code: string }
  ```
- Response Body:
  ```ts
  { token: string }
  ```
- Response Status:
  - `200 OK`：登录成功，首次登录时自动注册用户
  - `400 Bad Request`：code 参数无效
  - `401 Unauthorized`：微信授权失败

- 说明：
  - 首次登录自动创建 `users` 与 `user_wechat` 记录
  - 已存在的微信身份再次登录时复用同一用户

## 手机号密码登录

- URL: `/user/login/password`
- Method: `POST`
- Request Body:
  ```ts
  Pick<User.PhoneBinding, 'country_code' | 'phone'> & { password: string }
  ```
- Response Body:
  ```ts
  { token: string }
  ```
- Response Status:
  - `200 OK`：登录成功
  - `400 Bad Request`：用户名或密码为空
  - `401 Unauthorized`：用户名不存在或密码错误

- 说明：
  - 用户名登录与微信登录共享同一套 `users` 主表
  - 后续微信用户可补绑密码后使用该接口登录

## 初始化管理员账号

该能力优先通过 CLI 提供，不暴露公开 HTTP 接口。

- Command: `pnpm -w s cr7 user init-admin --phone <phone> --password <password>`
- 行为：
  - `--phone` 只需提供本地号码，如 `12345678901`，国别码默认 `+86` 由系统补全
  - 若手机号已存在于 `user_phone`，则设置其对应用户为系统管理员
  - 创建 `users(name = 'system admin')`
  - 创建 `user_phone(country_code = '+86', phone = <phone>)`
  - 绑定 `ADMIN` 角色
  - 创建 `user_password`，供管理员使用密码登录

## 修改当前用户密码

- URL: `/user/password`
- Method: `PUT`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  {
    current_password: string;
    new_password: string;
  }
  ```
- Response Status:
  - `204 No Content`：修改成功
  - `400 Bad Request`：参数不合法或新旧密码相同
  - `401 Unauthorized`：未认证或当前密码错误
  - `404 Not Found`：当前用户未绑定密码认证方式

- 说明：
  - 只有已绑定密码的用户才能修改密码
  - 微信用户后续绑定密码后，也复用该接口

## 获取当前用户信息

- URL: `/user/profile`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Response Body:
  ```ts
  User.Profile
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证

- 说明：
  - 手机号密码登录与微信登录共享同一套 `users` 主表
  - `avatar` 未设置时返回 `null`
  - `profile` 始终返回对象，未设置时返回空对象
  - `damai_user_id` 对未绑定大麦账号的用户为 `null`
  - `openid` 对未绑定微信的用户为 `null`
  - `phone` 对未绑定手机号的用户为 `null`，绑定后返回完整格式如 `+86 12345678901`
  - `auth_methods` 返回当前用户已绑定的认证方式列表，如 `['DAMAI', 'WECHAT_MINI', 'PASSWORD']`

## 更新当前用户信息

- URL: `/user/profile`
- Method: `PUT`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  Partial<Pick<User.Profile, 'name' | 'avatar' | 'profile'>>
  ```
- Response Status:
  - `204 No Content`：更新成功
  - `400 Bad Request`：参数不合法
  - `401 Unauthorized`：未认证

- 说明：
  - 仅更新当前登录用户自身资料
  - `name`、`avatar` 为可选字段，未传则保持原值
  - `profile` 为可选对象，传入时按 key 合并到现有资料，不会清空未传入字段
  - 更新后可通过 `GET /user/profile` 读取最新资料

## 为用户授予角色

- URL: `/users/:uid/roles`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { uid: string }
  ```
- Request Body:
  ```ts
  { role_name: string }
  ```
- Response Body:
  ```ts
  { role_names: string[] }
  ```
- Response Status:
  - `200 OK`：授予成功
  - `400 Bad Request`：角色不存在或参数无效
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无权限（仅管理员可执行）
  - `404 Not Found`：用户不存在

- 说明：
  - 仅管理员（ADMIN 角色）可执行此操作
  - 返回用户授予后的全部角色名称
  - 同一用户同一角色重复授予时幂等

## 管理员查看用户列表

- URL: `/users`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Query Parameters:
  ```ts
  {
    phone?: string;  // 可选，按手机号精确过滤
    damai_user_id?: string; // 可选，按大麦用户 ID 精确过滤
    page?: number;   // 可选，页码，默认 1
    limit?: number;  // 可选，每页数量，默认 20
  }
  ```
- Response Body:
  ```ts
  User.UserListResult
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无权限（仅管理员可执行）

- 说明：
  - 不传 `phone` 时返回全部用户列表（分页）
  - 传 `phone` 时按手机号精确过滤，例如 `12345678901`
  - 传 `damai_user_id` 时按大麦用户 ID 精确过滤
  - `phone` 与 `damai_user_id` 可同时传入，按与关系组合过滤
  - `page` 和 `limit` 均可选，默认返回第 1 页，每页 20 条
  - `damai_user_id` 对未绑定大麦账号的用户为 `null`
  - 列表中的 `phone` 保持完整格式（如 `+86 12345678901`）
