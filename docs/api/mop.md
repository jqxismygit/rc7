# 猫眼 MOP 对接接口

本文档描述管理端触发展览项目同步到猫眼 MOP 的接口。

## 同步展览项目到 MOP

- URL: `/exhibition/:eid/ota/mop/sync`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Response Status:
  - `204 No Content`：同步请求发送成功
  - `400 Bad Request`：参数错误或展览城市暂不支持同步（`MOP_CITY_NOT_SUPPORTED`）
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员权限
  - `404 Not Found`：展览不存在
- 关键特性：
  - 仅管理员可执行该接口
  - 当前仅支持上海展览同步（城市映射为 `310000` / `上海市`）
  - 同步请求会读取本地 MOP 密钥配置并按 MOP 协议签名后提交
  - 接口本身不返回业务体，成功仅返回 `204`

## 类型来源

- 路径参数中的 `eid` 对应展览主键，展览类型定义见 `services/types/exhibition.ts` 中 `Exhibition.Exhibition`。

## 相关文档

- MOP 平台协议说明见 `docs/ota/mop.md`