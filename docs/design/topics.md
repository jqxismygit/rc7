# Topics & Article 设计

本文档描述话题（Topic）与文章（Article）模块的实现设计，覆盖权限、流程和关键业务约束。

## 1. 目标与边界

### 1.1 目标

- 支持管理员创建、修改、删除话题。
- 支持管理员在话题下创建、修改、删除文章。
- 支持管理员调整同一话题下的文章顺序。
- 支持用户查看话题列表和文章详情。
- 支持管理员上传文章/话题图片，统一生成 webp URL。

### 1.2 非目标

- 不实现评论、点赞、收藏等互动能力。
- 不实现文章版本历史。
- 不实现话题推荐排序算法（话题默认按创建时间倒序）。

## 2. 权限模型

- 话题与文章的写接口需要登录且具备 `ADMIN` 角色。
- 用户侧查询接口：公开可访问。
- 上传接口：仅管理员可调用。

权限规则：
- `POST /topics`、`PATCH /topics/:tid`、`DELETE /topics/:tid` 仅管理员可调用。
- `POST /topics/:tid/articles`、`PATCH /articles/:aid`、`DELETE /articles/:aid` 仅管理员可调用。
- `PATCH /topics/:tid/articles/order` 仅管理员可调用。
- `POST /assets/images` 仅管理员可调用。
- `GET /topics`、`GET /articles/:aid` 为公开接口。
- 资源不存在统一返回 `404`，不泄漏内部状态。

## 3. 领域模型

- Topic：`id`、`title`、`description`、`cover_url`、时间戳。
- Article：`id`、`topic_id`、`title`、`subtitle`、`content`、`cover_url`、`sort_order`、时间戳。

业务约束：
- 文章必须归属一个话题（`topic_id` 必填）。
- `description` 为可选字段；未提供时存储为 `null`。
- `cover_url` 为可选字段；未提供时存储为 `null`。
- `subtitle` 为可选字段；未提供时存储为 `null`。
- `sort_order` 为文章在话题内的顺序值，数值越小越靠前。
- 删除话题时级联删除其文章。


## 4. 接口流程

### 4.1 创建话题

接口：`POST /topics`

1. 校验管理员身份。
2. 校验标题；若传入描述或封面 URL，再校验其格式。
3. 写入 topic 数据并返回创建结果。

### 4.2 修改话题

接口：`PATCH /topics/:tid`

1. 校验管理员身份。
2. 校验话题存在。
3. 对可变字段做部分更新（PATCH 语义）。

### 4.3 删除话题

接口：`DELETE /topics/:tid`

1. 校验管理员身份。
2. 校验话题存在。
3. 删除话题，并通过外键级联删除其下文章。

### 4.4 创建文章

接口：`POST /topics/:tid/articles`

1. 校验管理员身份。
2. 校验目标话题存在。
3. 校验文章标题、内容；若传入副标题或封面 URL，再校验其格式。
4. 写入 article 并返回。

### 4.5 修改文章

接口：`PATCH /articles/:aid`

1. 校验管理员身份。
2. 校验文章存在。
3. 对文章可变字段做部分更新（含 `subtitle`）。

### 4.6 删除文章

接口：`DELETE /articles/:aid`

1. 校验管理员身份。
2. 校验文章存在。
3. 删除文章并返回 `204`。

### 4.7 查看话题列表

接口：`GET /topics`

1. 按分页查询 topic。
2. 只返回话题基本字段，不聚合文章列表。

### 4.8 查看话题详情

接口：`GET /topics/:tid`

1. 按 `tid` 查询话题。
2. 汇总该话题下的文章列表（按 `sort_order ASC, created_at DESC` 排序）。
3. 返回 `TopicWithArticles`（含话题信息 + 文章摘要列表）。

### 4.9 查看文章详情

接口：`GET /articles/:aid`

1. 按 `aid` 查询文章。
2. 关联返回所属话题基础信息。

### 4.10 上传图片

接口：`POST /assets/images`

1. 校验管理员身份。
2. 从 multipart/form-data 的 `image` 字段读取文件 stream。
3. action 直接接收该 stream，并校验文件类型（jpg/jpeg/png/webp）。
4. 将 stream 直接 pipe 到 `sharp` 做图片转码。
5. 统一输出为 webp，并写入 `assets` 目录。
6. 返回静态资源 URL：`<assets.base_url>/<uuid>.webp`。

### 4.11 调整文章顺序

接口：`PATCH /topics/:tid/articles/order`

1. 校验管理员身份。
2. 校验话题存在。
3. 校验 `article_ids` 为当前话题下文章 ID 的完整集合（不允许缺失、重复或跨话题 ID）。
4. 在事务中按请求数组顺序重写 `sort_order`（从 `0` 递增）。
5. 返回更新后的顺序结果。

## 5. 幂等与一致性

- 删除文章/话题采用硬删除；重复删除返回 `404`。
- 话题删除与文章级联删除由数据库外键保证一致性。
- 话题列表只返回话题基本信息，文章详情通过话题详情接口单独获取。
- 话题详情中的文章列表通过聚合查询实时获取，避免冗余字段漂移。
- 话题详情中的文章列表按 `sort_order` 稳定排序，未显式调整时保持“新建优先”。
- 上传接口只负责生成可复用图片 URL；业务表中的 `cover_url` 可为空。
- 图片处理链路不经过临时文件，直接由 action 接收 stream 并 pipe 到 `sharp` 后写入 `assets` 目录。

## 6. 错误码约定

- `400 Bad Request`：参数校验失败、图片格式不合法。
- `401 Unauthorized`：未认证。
- `403 Forbidden`：无管理员权限。
- `404 Not Found`：话题或文章不存在。

## 7. 测试映射（对应 feature）

- 管理员创建/修改/删除话题。
- 管理员在话题下创建/修改/删除文章。
- 用户查看文章详情。
- 用户查看话题列表（仅基本信息）。
- 用户查看话题详情（含文章列表）。
- 管理员调整话题下文章顺序。
- 管理员上传图片并返回 `${assets.base_url}/<uuid>.webp`。
