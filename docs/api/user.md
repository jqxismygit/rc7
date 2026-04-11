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

## 微信绑定手机号

- URL: `/user/phone/wechat`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  { code: string }
  ```
- Response Status:
  - `204 No Content`：绑定成功
  - `401 Unauthorized`：未认证
  - `409 Conflict`：手机号已被其他用户绑定

- 说明：
  - 使用微信手机号授权 `code` 向微信服务端换取手机号信息
  - 绑定成功后，`GET /user/profile` 中的 `phone` 将返回完整格式，例如 `+86 12345678901`

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

## 获取当前用户角色列表

- URL: `/user/roles`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Response Body:
  ```ts
  User.Role[]
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证

- 说明：
  - 仅返回当前登录用户自身的角色列表
  - 每个角色包含 `id`、`name` 和 `permissions`
  - 未授予任何角色时返回空数组

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
  { role_id: User.Role['id'] }
  ```
- Response Body:
  ```ts
  { roles: User.Role[] }
  ```
- Response Status:
  - `200 OK`：授予成功
  - `400 Bad Request`：参数无效
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无权限（仅管理员可执行）
  - `404 Not Found`：用户不存在或角色不存在

- 说明：
  - 仅管理员（ADMIN 角色）可执行此操作
  - 返回用户授予后的全部角色列表（含权限）
  - 同一用户同一角色重复授予时幂等

## 为用户收回角色

- URL: `/users/:uid/roles/:role_id`
- Method: `DELETE`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { uid: string; role_id: User.Role['id'] }
  ```
- Response Body:
  ```ts
  { roles: User.Role[] }
  ```
- Response Status:
  - `200 OK`：收回成功
  - `400 Bad Request`：不允许收回自己的 `ADMIN` 角色
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无权限（仅管理员可执行）
  - `404 Not Found`：角色不存在

- 说明：
  - 仅管理员（ADMIN 角色）可执行此操作
  - 返回用户收回后的全部角色列表（含权限）
  - 收回不存在的用户-角色关系时幂等（保持当前角色集合不变）

## 管理员查看角色列表

- URL: `/users/roles`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Response Body:
  ```ts
  User.Role[]
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无权限（仅管理员可执行）

- 说明：
  - 返回系统角色全集，按角色名称升序

## 管理员创建角色

- URL: `/users/roles`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  Omit<User.Role, 'id'>
  ```
- Response Body:
  ```ts
  User.Role
  ```
- Response Status:
  - `200 OK`：创建成功
  - `400 Bad Request`：参数无效
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无权限（仅管理员可执行）
  - `409 Conflict`：角色冲突（如角色名已存在）

- 说明：
  - 仅管理员（ADMIN 角色）可执行此操作
  - 创建后返回完整角色对象

## 管理员删除角色

- URL: `/users/roles/:role_id`
- Method: `DELETE`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { role_id: User.Role['id'] }
  ```
- Response Status:
  - `204 No Content`：删除成功
  - `400 Bad Request`：内置角色不允许删除
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无权限（仅管理员可执行）
  - `404 Not Found`：角色不存在

- 说明：
  - 仅管理员（ADMIN 角色）可执行此操作
  - 角色删除后，其对应用户-角色关系会被级联删除

## 管理员添加新用户

- URL: `/users`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  Pick<User.Profile, 'name'>
    & Pick<User.PhoneBinding, 'phone'>
    & { country_code?: User.PhoneBinding['country_code']; password: string }
  ```
- Response Body:
  ```ts
  User.Profile
  ```
- Response Status:
  - `201 Created`：创建成功
  - `400 Bad Request`：参数无效
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无权限（仅管理员可执行）
  - `409 Conflict`：手机号已存在

- 说明：
  - 仅管理员（ADMIN 角色）可执行此操作
  - 创建时会同时写入 `users`、`user_phone`、`user_password`
  - 默认 `country_code` 为 `+86`

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
    role_id?: string; // 可选，按角色 ID 精确过滤
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
  - 传 `role_id` 时按角色 ID 精确过滤，仅返回拥有该角色的用户
  - 传 `damai_user_id` 时按大麦用户 ID 精确过滤
  - `phone`、`role_id` 与 `damai_user_id` 可同时传入，按与关系组合过滤
  - `page` 和 `limit` 均可选，默认返回第 1 页，每页 20 条
  - `damai_user_id` 对未绑定大麦账号的用户为 `null`
  - 列表中的 `phone` 保持完整格式（如 `+86 12345678901`）
