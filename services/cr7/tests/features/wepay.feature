Feature: 微信支付订单

  Background:
    Given 微信支付已配置完成
    Given 微信用户 "wechat_user_1" 已注册并登录


  Scenario: 用户下单展会门票并发起支付
    Given 用户预订了 1 张 "CR7" 展会 的 "2026-07-01" 场次的 "成人票"
    When 在微信小程序中向 cr7 支付服务发起支付
    Then 微信支付服务收到支付请求
     And 订单号 out-trade-no 为订单号去掉 - 符号后的字符串
     And 商品描述 description 为 "CR7 展会 成人票 2026-07-01 场次"
     And 价格 amount 为订单金额，单位为分
     And 支付过期时间为订单创建时间加 "30" 分钟，格式为 "yyyy-MM-DDTHH:mm:ss+TIMEZONE"
     And 返回预支付信息 "mock_prepay_id_12345"
    Then cr7 支付服务结合 prepay_id 生成支付签名并返回给微信小程序
     And 微信小程序收到可以发起支付的 pay sign 和其他必要参数

  Scenario: 用户下单展会门票并支付成功
    Given 用户预订了 1 张 "CR7" 展会 的 "2026-07-01" 场次的 "成人票"
    Given 用户已发起支付并获得 pay sign
    When 用户完成微信支付
    Then 微信支付服务回调支付结果，支付成功
     And out-trade-no 为订单号去掉 - 符号后的字符串
     And cr7 支付服务收到支付结果通知并验证订单信息正确
     And 订单状态为 "已支付"

  Scenario: 用户下单展会门票发起支付后取消订单
    Given 用户预订了 1 张 "CR7" 展会 的 "2026-07-01" 场次的 "成人票"
    Given 用户已发起支付并获得 pay sign
    When 用户停止支付并取消订单
     And 微信支付服务收到订单关闭请求
     And out-trade-no 为订单号去掉 - 符号后的字符串
    Then 订单状态更新为 "已取消"

  @todo
  Scenario: 过期的订单不能发起支付
