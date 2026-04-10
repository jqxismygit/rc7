Feature: 用户已购票的查询与核销
  Background:
    Given 系统管理员已经创建并登录
    Given 用户 "Alice" 已注册并登录，已绑定手机号
    Given "Bob" 已注册并登录，已绑定手机号
      And "Bob" 被授予 "运营" 角色
    Given 默认核销展览活动已创建，开始时间为 "今天"，结束时间为 "3天后"
    Given 展会添加票种 "early_bird", 准入人数为 1, 有效期为场次当天
    Given "early_bird" 库存为 2

  Scenario: 一个完成支付的订单拥有一个核销码
    Given 用户预订 2 张该展会的 "今天" 场次的 "early_bird"
    Given 用户完成支付
     When 用户查询订单核销信息
     Then 订单详情中包含一个核销码
      And 核销码的长度为 "12" 位
      And 核销码的第一位是 "R" 先做保留字
      And 核销码最后两位是 Luhn 校验码且正确
      And 核销码中间的9位字符集 "23456789ABCDEFGHJKLMNPQRSTUVWXYZ" 组成, 不包含易混淆的字符如 "0", "1", "I", "O"
      And 核销码的状态为未核销
      And 核销码下有两张 "early_bird" 票
      And 核销码的准入人数为 "2"
      And 核销码的有效期为场次当天

  Scenario: 使用核销码完成订单核销
    Given 用户预订 2 张该展会的 "今天" 场次的 "early_bird"
     When 用户完成支付
     Then 用户有一个有效的核销码
     When 运营人员将用户 "Alice" 的订单核销码扫码核销
     Then 核销成功
      And 核销码状态变为 "已核销"
      And 核销码的核销时间被记录
      And 核销码的核销人为运营人员

  Scenario: 一个未完成支付的订单没有核销码
    Given 用户预订 1 张该展会的 "今天" 场次的 "early_bird"
     When 用户查询订单核销信息
     Then 操作失败，状态码为 410
      And 错误类型为 "ORDER_NOT_REDEEMABLE"

  Scenario: 已过期订单的核销码不可用
    Given 用户预订 1 张该展会的 "今天" 场次的 "early_bird"
     When 用户完成支付
     Then 用户有一个有效的核销码
    Given 核销码已过期
     When 运营人员将用户 "Alice" 的订单核销码扫码核销
     Then 操作失败，状态码为 409
      And 错误类型为 "REDEMPTION_EXPIRED"

  Scenario: 已核销订单的核销码不可重复使用
    Given 用户预订 1 张该展会的 "今天" 场次的 "early_bird"
     When 用户完成支付
     Then 用户有一个有效的核销码
     When 运营人员将用户 "Alice" 的订单核销码扫码核销
     Then 核销成功
     When 运营人员再次将用户 "Alice" 的订单核销码扫码核销
     Then 操作失败，状态码为 409
      And 错误类型为 "REDEMPTION_ALREADY_REDEEMED"

  Scenario: 当天场次的核销码从今天零点起有效
    Given 用户预订 1 张该展会的 "今天" 场次的 "early_bird"
     When 用户完成支付
     Then 用户有一个有效的核销码
      And 核销码的有效期起始时间不晚于当前时间
      And 运营人员将用户 "Alice" 的订单核销码立即扫码核销成功

  Scenario: 只有运营人员才能核销
    Given 用户预订 1 张该展会的 "今天" 场次的 "early_bird"
     When 用户完成支付
     Then 用户有一个有效的核销码
     When 用户 "Alice" 尝试核销用户 "Alice" 的订单核销码
     Then 操作失败，状态码为 403
      And 错误类型为 "FORBIDDEN_ACCESS"
     When 运营人员将用户 "Alice" 的订单核销码扫码核销
     Then 核销成功
      And 核销码的核销人为 "运营人员"

  Scenario: 已经核销的订单不能发起退款
    Given 该展会追加了一个 "成人票" 票种, 退票策略是 "截止时间为场次开始前 48 小时"
      And "成人票" 库存为 2
    Given 用户预订 1 张该展会的 "今天" 场次的 "成人票"
     When 用户完成支付
     Then 用户有一个有效的核销码
    Given 订单已被核销
     When 用户发起退款请求
     Then 操作失败，状态码为 409
      And 错误信息包含 "订单已核销，无法退款"
      And 订单状态仍然为 "已支付"

  Scenario: 已经处于退款流程的订单不能被核销
    Given 该展会追加了一个 "成人票" 票种, 退票策略是 "截止时间为场次开始前 48 小时"
      And "成人票" 库存为 2
    Given 用户预订 1 张该展会的 "3天后" 场次的 "成人票"
     When 用户完成支付
     Then 用户有一个有效的核销码
    Given 用户已发起退款请求，订单状态为 "退款已受理"
     When 运营人员扫码核销用户的订单核销码
     Then 核销失败，状态码为 409, 错误信息为 "订单退款中，无法核销"
    Given 微信支付服务通知 cr7 支付服务退款状态为 "退款处理中"
     When 运营人员再次扫码核销用户的订单核销码
     Then 退款处理中导致再次核销失败，状态码为 409, 错误信息为 "订单退款中，无法核销"
    Given 微信支付服务通知 cr7 支付服务退款结果，退款成功
     When 运营人员在退款成功后再次扫码核销用户的订单核销码
     Then 退款成功导致的核销失败，状态码为 409, 错误信息为 "订单退款中，无法核销"
