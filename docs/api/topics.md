# 话题与文章接口

基于 `Topic` 类型（来自 [@cr7/types/topic](../../services/types/topic.ts)）定义。

## 概念说明

- Topic（话题）：内容聚合主题，包含标题、描述、封面图。
- Article（文章）：归属于某个话题的内容条目，包含标题、副标题、正文和封面图。
- 关键字段：
  - `description`：话题描述，可为空。
  - `cover_url`：图片上传成功后返回的 URL，可为空。
  - `sort_order`：文章在话题内的排序值，数值越小越靠前。

## 管理员创建话题

- URL: `/topics`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  Topic.TopicDraft
  ```
- Response Body:
  ```ts
  Topic.Topic
  ```
- Response Status:
  - `201 Created`：创建成功
  - `400 Bad Request`：参数错误（标题为空、描述或封面 URL 非法等）
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限

- 说明：
  - `description`、`cover_url` 为可选字段；未传时返回 `null`。

## 管理员修改话题

- URL: `/topics/:tid`
- Method: `PATCH`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { tid: string }
  ```
- Request Body:
  ```ts
  Topic.TopicPatch
  ```
- Response Body:
  ```ts
  Topic.Topic
  ```
- Response Status:
  - `200 OK`：修改成功
  - `400 Bad Request`：参数错误
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限
  - `404 Not Found`：话题不存在

## 管理员删除话题

- URL: `/topics/:tid`
- Method: `DELETE`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { tid: string }
  ```
- Response Status:
  - `204 No Content`：删除成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限
  - `404 Not Found`：话题不存在

- 说明：
  - 删除话题会级联删除该话题下的文章。
  - 重复删除同一话题返回 `404 Not Found`。

## 管理员在话题下创建文章

- URL: `/topics/:tid/articles`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { tid: string }
  ```
- Request Body:
  ```ts
  Omit<Topic.ArticleDraft, 'topic_id'>
  ```
- Response Body:
  ```ts
  Topic.Article
  ```
- Response Status:
  - `201 Created`：创建成功
  - `400 Bad Request`：参数错误
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限
  - `404 Not Found`：话题不存在

- 说明：
  - `subtitle`、`cover_url` 为可选字段；未传时返回 `null`。

## 管理员修改文章

- URL: `/articles/:aid`
- Method: `PATCH`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { aid: string }
  ```
- Request Body:
  ```ts
  Topic.ArticlePatch
  ```
- Response Body:
  ```ts
  Topic.Article
  ```
- Response Status:
  - `200 OK`：修改成功
  - `400 Bad Request`：参数错误
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限
  - `404 Not Found`：文章不存在

## 管理员删除文章

- URL: `/articles/:aid`
- Method: `DELETE`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { aid: string }
  ```
- Response Status:
  - `204 No Content`：删除成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限
  - `404 Not Found`：文章不存在

## 用户查看文章详情

- URL: `/articles/:aid`
- Method: `GET`
- Request Params:
  ```ts
  { aid: string }
  ```
- Response Body:
  ```ts
  Topic.ArticleWithTopic
  ```
- Response Status:
  - `200 OK`：查询成功
  - `404 Not Found`：文章不存在

## 用户查看话题列表

- URL: `/topics`
- Method: `GET`
- Query Parameters:
  ```ts
  {
    page?: number;
    limit?: number;
  }
  ```
- Response Body:
  ```ts
  Topic.TopicListResult
  ```
- Response Status:
  - `200 OK`：查询成功
  - `400 Bad Request`：分页参数错误

- 说明：
  - 只返回话题基本信息（`Topic`），不含文章列表。
  - 如需查看话题下的文章，请调用话题详情接口。

## 用户查看话题详情

- URL: `/topics/:tid`
- Method: `GET`
- Request Params:
  ```ts
  { tid: string }
  ```
- Response Body:
  ```ts
  Topic.TopicWithArticles
  ```
- Response Status:
  - `200 OK`：查询成功
  - `404 Not Found`：话题不存在

- 说明：
  - 返回话题完整信息，包含文章列表。
  - 文章列表排序规则：先按 `sort_order ASC`，再按 `created_at DESC`。
  - 文章项包含 `subtitle` 字段（可能为 `null`）。

## 管理员调整话题下文章顺序

- URL: `/topics/:tid/articles/order`
- Method: `PATCH`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { tid: string }
  ```
- Request Body:
  ```ts
  Topic.ReorderTopicArticlesRequest
  ```
- Response Body:
  ```ts
  Topic.ReorderTopicArticlesResult
  ```
- Response Status:
  - `200 OK`：调整成功
  - `400 Bad Request`：参数错误（空数组、重复文章 ID、文章不属于该话题等）
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限
  - `404 Not Found`：话题不存在

- 说明：
  - `article_ids` 需包含该话题下全部文章且不重复。
  - 服务端按数组顺序重写 `sort_order`（从 `0` 递增）。

## 错误响应

所有接口在出错时返回以下格式：

```ts
{
  code: string;
  message: string;
}
```

常见错误码（HTTP Status Code）：
- `TOPIC_NOT_FOUND`（404）
- `ARTICLE_NOT_FOUND`（404）
- `TOPIC_TITLE_REQUIRED`（400）
- `ARTICLE_CONTENT_REQUIRED`（400）
- `TOPIC_DESCRIPTION_INVALID`（400）
- `TOPIC_COVER_URL_INVALID`（400）
- `ARTICLE_COVER_URL_INVALID`（400）
- `PERMISSION_DENIED`（403）
