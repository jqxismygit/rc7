# 用户相关接口

## 微信小程序登录/注册

- URL: `/api/user/login/wechat/mini`
- Method: `POST`
- Request Body:
  ```ts
  {
    code: string
  }
  ```
- Response Body:
  ```ts
  { token: string }
  ```

## 获取用户信息

- URL: `/api/user/profile`
- Method: `GET`
- Response Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Response Body:
  ```ts
  {
    id: number;
    name: string;
    openid: string;
    created_at: string;
    updated_at: string;
  }
  ```
