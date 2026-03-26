Feature: 用户已购票的查询与核销
  Background:
    Given 系统管理员已经创建并登录
    Given 用户 "Alice" 已注册并登录

  Scenario: 一个完成支付的订单拥有一个核销码
    Given 展览活动 "CR7" 已创建，包含场次 "今天" 和票种 "early_bird"
      And "early_bird" 票种的有效期为场次当天有效
      And "early_bird" 票种准入人数为 "1"
      And 场次 "今天" 的 "early_bird" 库存初始为 2
    Given 用户在一个订单里购买了 2 张 "CR7" 的 "今天" 场次的 "early_bird"
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
    Given 展览活动 "CR7" 已创建，包含场次 "今天" 和票种 "early_bird"
      And "early_bird" 票种的有效期为场次当天有效
      And 场次 "今天" 的 "early_bird" 库存初始为 2
    Given 用户在一个订单里购买了 2 张 "CR7" 的 "今天" 场次的 "early_bird"
     When "管理员"将用户 "Alice" 的订单核销码扫码核销
     Then 核销成功
      And 核销码状态变为 "已核销"
      And 核销码的核销时间被记录
      And 核销码的核销人为 "管理员"

  Scenario: 一个未完成支付的订单没有核销码
    Given 展览活动 "CR7" 已创建，包含场次 "今天" 和票种 "early_bird"
      And "early_bird" 票种的有效期为场次当天有效
      And 场次 "今天" 的 "early_bird" 库存初始为 2
    Given 用户在一个未完成支付订单里购买了 1 张 "CR7" 的 "今天" 场次的 "early_bird"
     When 用户查询订单核销信息
     Then 查询核销信息失败，状态码为 410
      And 查询核销信息错误类型为 "ORDER_NOT_REDEEMABLE"

  Scenario: 已过期订单的核销码不可用
    Given 展览活动 "CR7" 已创建，包含场次 "今天" 和票种 "early_bird"
      And "early_bird" 票种的有效期为场次当天有效
      And 场次 "今天" 的 "early_bird" 库存初始为 2
    Given 用户在一个订单里购买了 1 张 "CR7" 的 "今天" 场次的 "early_bird"
      And 核销码已过期
     When "管理员"将用户 "Alice" 的订单核销码扫码核销
     Then 核销失败，状态码为 409
      And 核销失败错误类型为 "REDEMPTION_EXPIRED"

  Scenario: 已核销订单的核销码不可重复使用
    Given 展览活动 "CR7" 已创建，包含场次 "今天" 和票种 "early_bird"
      And "early_bird" 票种的有效期为场次当天有效
      And 场次 "今天" 的 "early_bird" 库存初始为 2
    Given 用户在一个订单里购买了 1 张 "CR7" 的 "今天" 场次的 "early_bird"
     When "管理员"将用户 "Alice" 的订单核销码扫码核销
      And "管理员"再次将用户 "Alice" 的订单核销码扫码核销
     Then 再次核销失败，状态码为 409
      And 核销失败错误类型为 "REDEMPTION_ALREADY_REDEEMED"

  Scenario: 当天场次的核销码从今天零点起有效
    Given 展览活动 "CR7" 已创建，包含场次 "今天" 和票种 "early_bird"
      And "early_bird" 票种的有效期为场次当天有效
      And 场次 "今天" 的 "early_bird" 库存初始为 2
    Given 用户在一个订单里购买了 1 张 "CR7" 的 "今天" 场次的 "early_bird"
     When 用户查询订单核销信息
     Then 核销码的有效期起始时间不晚于当前时间
      And "管理员"将用户 "Alice" 的订单核销码立即扫码核销成功

  Scenario: 只有运营人员才能核销
    Given 展览活动 "CR7" 已创建，包含场次 "今天" 和票种 "early_bird"
      And "early_bird" 票种的有效期为场次当天有效
      And 场次 "今天" 的 "early_bird" 库存初始为 2
    Given 用户在一个订单里购买了 1 张 "CR7" 的 "今天" 场次的 "early_bird"
      And 用户 "Bob" 已注册并登录
      And 用户 "Bob" 被授予 "运营" 角色
     When 用户 "Alice" 尝试核销用户 "Alice" 的订单核销码
     Then 核销失败，状态码为 403
      And 核销失败错误类型为 "FORBIDDEN_ACCESS"
     When "运营人员"将用户 "Alice" 的订单核销码扫码核销
     Then 核销成功
      And 核销码的核销人为 "运营人员"

  Scenario: 已经核销的订单不能发起退款
    Given 用户在一个订单里购买了 1 张 "CR7" 的 "今天" 场次的 "成人票"
    Given 用户已完成支付
    Given 订单已被核销
    When 用户发起退款请求
    Then cr7 支付服务拒绝退款请求，返回错误信息 "订单已核销，无法退款"
     And 订单状态仍然为 "已支付"

  Scenario: 已经处于退款流程的订单不能被核销
    Given 用户在一个订单里购买了 1 张 "CR7" 的 "3天后" 场次的 "成人票"
    Given 用户已完成支付
    Given 用户已发起退款请求，订单状态为 "退款已受理"
    When "管理员"扫码核销用户的订单核销码
    Then 核销失败，状态码为 409
     And 核销失败, 错误信息为 "订单退款中，无法核销"
    When 微信支付服务通知 cr7 支付服务退款状态为 "退款处理中"
    When "管理员"再次扫码核销用户的订单核销码
    Then 再次核销失败，状态码为 409
     And 再次核销失败, 错误信息为 "订单退款中，无法核销"
    When 微信支付服务通知 cr7 支付服务退款结果，退款成功
    When "管理员"在退款成功后再次扫码核销用户的订单核销码
    Then 退款成功后核销失败，状态码为 409
     And 退款成功后核销失败, 错误信息为 "订单退款中，无法核销"

