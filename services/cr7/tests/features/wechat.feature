
Feature: 微信服务

  Background:
    Given 微信服务端已准备好

  Scenario: 维护微信 access_token
     When 启动 cr7 的微信 service
     Then 微信服务端收到 access token 的请求
     Then 微信服务端收到 access token 的请求的次数为 1

     Then 微信服务端返回 "access_token_1"，过期时间为 7200 秒
     When 从微信 service 获取 access token
     Then 获取成功，access token 是 "access_token_1"
      And 微信服务端收到 access token 的请求的次数仍然为 1

     When 等待 6000 秒后
     Then 微信服务端收到 access token 的请求的次数为 2
     Then 微信服务端再次返回 "access_token_2"，过期时间为 7200 秒
     When 再次从微信 service 获取 access token
     Then 再次获取成功，access token 是 "access_token_2"
      And 微信服务端收到 access token 的请求的次数仍然为 2

