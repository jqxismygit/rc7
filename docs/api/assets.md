# 资源上传接口

基于上传接口返回结构定义。

## 管理员上传图片

- URL: `/assets/images`
- Method: `POST`
- Request Header:
  ```ts
  {
    Authorization: `Bearer ${token}`,
    // 与文件格式一致，例如 image/jpeg、image/png、image/webp
    'Content-Type': string
  }
  ```
- Request Body:
  - 原始图片二进制流（非 `multipart/form-data`），支持 jpg/jpeg/png/webp 等可被解码的格式。
- Response Body:
  ```ts
  { url: string }
  ```
- Response Status:
  - `201 Created`：上传成功
  - `400 Bad Request`：文件为空或格式不支持
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限

- 说明：
  - 返回图片 URL 使用配置 `assets.base_url` 作为前缀。
  - 返回图片 URL 的后缀固定为 `.webp`。

## 管理员上传视频

- URL: `/assets/videos`
- Method: `POST`
- Request Header:
  ```ts
  {
    Authorization: `Bearer ${token}`,
    // 建议与文件格式一致，例如 video/mp4
    'Content-Type': string
  }
  ```
- Request Body:
  - 原始视频二进制流（非 `multipart/form-data`）。
- Response Body:
  ```ts
  { url: string }
  ```
- Response Status:
  - `201 Created`：上传成功
  - `400 Bad Request`：文件为空或格式不支持
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限

- 说明：
  - 返回视频 URL 使用配置 `assets.base_url` 作为前缀。
  - 返回视频 URL 的后缀为原始视频扩展名（如 `.mp4`）。

## 错误响应

所有接口在出错时返回以下格式：

```ts
{
  code: string;
  message: string;
}
```

常见错误码（HTTP Status Code）：
- `IMAGE_INVALID_TYPE`（400）
- `PERMISSION_DENIED`（403）