Feature: 用户已购票的查询与核销
  Background:
    Given 系统管理员已经创建并登录
    Given 用户 "Alice" 已注册并登录

  Scenario: 一个完成支付的订单拥有一个核销码
    Given 展览活动 "CR7" 已创建，包含场次 "2026-07-01" 和票种 "early_bird"
      And "early_bird" 票种的有效期为场次当天有效
      And "early_bird" 票种准入人数为 "1"
      And 场次 "2026-07-01" 的 "early_bird" 库存初始为 2
    Given 用户在一个订单里购买了 2 张 "CR7" 的 "2026-07-01" 场次的 "early_bird"
     When 用户查询订单核销信息
     Then 订单详情中包含一个核销码
      And 核销码的状态为未核销
      And 核销码下有两张 "early_bird" 票
      And 核销码的准入人数为 "2"
      And 核销码的有效期为场次当天


  Scenario: 使用核销码完成订单核销
    Given 展览活动 "CR7" 已创建，包含场次 "今天" 和票种 "early_bird"
      And "early_bird" 票种的有效期为场次当天有效
      And 场次 "今天" 的 "early_bird" 库存初始为 2
    Given 用户在一个订单里购买了 2 张 "CR7" 的 "今天" 场次的 "early_bird"
     When 用户使用核销码完成核销
     Then 核销成功
      And 核销码状态变为已核销

  @TODO
  Scenario: 一个未完成支付的订单没有核销码

  @TODO
  Scenario: 已过期订单的核销码不可用


