Feature: Order ticket
  Background:
    Given cr7 服务已启动
    Given 系统管理员已经创建并登录
    Given 用户 "Alice" 已注册并登录，手机号为 "12345678901", 国别码为 "86"
      And 用户 "Bob" 已注册并登录，没有绑定手机号
    Given 默认展览活动已创建, 启始时间为 "1天前", 结束时间为 "5天后"
    Given 展会添加票种 "成人票"
    Given "成人票" 所有场次库存为 3

  Scenario: 用户没有绑定手机号时，无法创建订单
   Given 用户 "Bob" 预订 1 张该展会的 "3天后" 场次的 "成人票"
    Then 预订失败，提示请先绑定手机号

   Given 用户 "Bob" 已经通过微信绑定手机号，国家码为 "886"，手机号为 "12345678902"
    When 用户 "Bob" 预订 1 张该展会的 "3天后" 场次的 "成人票"
    Then 预订成功

    Then 场次 "3天后" 的 "成人票" 库存为 2

  Scenario: 创建订单成功
    When 用户 "Alice" 预订 1 张该展会的 "3天后" 场次的 "成人票"
    Then 预订成功
     And 订单来源为 "DIRECT"

    Then 场次 "3天后" 的 "成人票" 库存为 2

  Scenario: 用户可使用半场场次 ID 预订
    When 用户 "Alice" 使用 "3天后" 场次的下午场 ID 预订 1 张该展会的 "成人票"
    Then 预订成功
     And 订单场次 ID 为 "3天后" 的原始场次 ID
     And 订单场次的半场状态是下午场，值为 "PM"

    Then 场次 "3天后" 的 "成人票" 库存为 2

  Scenario: 用户预订多个票种
   Given 该展览已追加票种 "儿童票"
   Given "儿童票" 所有场次库存为 3
    When 用户 "Alice" 预订 1 张该展会的 "3天后" 场次的 "成人票" 和 2 张 "儿童票"
    Then 预订成功

    Then 场次 "3天后" 的 "成人票" 库存为 2
    Then 场次 "3天后" 的 "儿童票" 库存为 1

  Scenario: 用户预订时同一票种重复提交会自动聚合
    When 用户 "Alice" 提交两条 "成人票" 订单项，数量分别为 1 和 2
    Then 预订成功
     And 订单中该票种数量为 3

    Then 场次 "3天后" 的 "成人票" 库存为 0

  Scenario: 预订超过库存数量的门票
    When 用户 "Alice" 预订 4 张该展会的 "3天后" 场次的 "成人票"
    Then 预订失败，提示库存不足

    Then 场次 "3天后" 的 "成人票" 库存为 3

  Scenario: 预订已过期场次的门票
    When 用户 "Alice" 预订 1 张该展会的 "1天前" 场次的 "成人票"
    Then 创建失败，提示场次已过期

    Then 场次 "1天前" 的 "成人票" 库存为 3

  Scenario: 取消付款
   Given 用户 "Alice" 已成功预订 1 张该展会的 "3天后" 场次的 "成人票"
    When 用户 "Alice" 取消订单
    Then 订单取消成功

    Then 场次 "3天后" 的 "成人票" 库存为 3

  Scenario: 订单过期未付款
   Given 用户 "Alice" 已成功预订 1 张该展会的 "3天后" 场次的 "成人票"
    When 订单过期未付款
    Then 订单变为过期状态不可再付款
     And 执行订单过期处理任务

    Then 场次 "3天后" 的 "成人票" 库存为 3

  Scenario: 重复取消同一订单不会重复释放库存
   Given 用户 "Alice" 已成功预订 1 张该展会的 "3天后" 场次的 "成人票"
    When 用户 "Alice" 取消订单
     And 第一次取消后场次 "3天后" 的 "成人票" 库存应为 3
     And 用户 "Alice" 再次取消同一订单
    Then 订单取消成功
     And 重复取消后场次 "3天后" 的 "成人票" 库存应为 3

  Scenario: 过期处理任务重复执行不会重复释放库存
   Given 用户 "Alice" 已成功预订 1 张该展会的 "3天后" 场次的 "成人票"
    When 订单过期未付款
     And 执行订单过期处理任务
     And 再次执行订单过期处理任务

    Then 场次 "3天后" 的 "成人票" 库存为 3

  Scenario: 用户可以获取自己的订单详情
   Given 用户 "Alice" 已成功预订 1 张该展会的 "3天后" 场次的 "成人票"
    When 用户 "Alice" 查看该订单详情
    Then 返回订单详情成功
     And 订单有场次时间，为 "3天后"
     And 订单包含 1 条订单项
     And 订单项为该展会的 "3天后" 场次的 "成人票"

  Scenario: 用户不能获取他人的订单详情
    Given 用户 "Bob" 已注册并登录
    Given 用户 "Bob" 已成功预订 1 张该展会的 "3天后" 场次的 "成人票"
     When 用户 "Alice" 查看 "Bob" 的订单详情
     Then 查看失败，提示订单不存在或无权限

  Scenario: 用户按分页查询订单列表
    Given 用户 "Alice" 已创建 3 笔订单
     When 用户 "Alice" 按 page 1、limit 2 查询订单列表
     Then 返回 2 条订单
      And total 为 3
      And page 为 1
      And limit 为 2

  Scenario: 用户按状态筛选订单列表
    Given 用户 "Alice" 有待支付订单、已取消订单和已过期订单
     When 用户 "Alice" 按状态 "待付款" 查询订单列表
     Then 仅返回待支付订单

  Scenario: 用户取消已过期订单失败
    Given 用户 "Alice" 有一笔已过期订单
     When 用户 "Alice" 取消该订单
     Then 取消失败，提示订单状态不允许取消

  Scenario: 用户创建空订单失败
    When 用户 "Alice" 提交空订单项创建订单
    Then 创建失败，提示参数不合法

  Scenario: 用户创建数量为 0 的订单项失败
    When 用户 "Alice" 预订 0 张该展会的 "3天后" 场次的 "成人票"
    Then 创建失败，提示参数不合法

  Scenario: 用户创建单个票数量超过 6 的订单项失败
    When 用户 "Alice" 预订 7 张该展会的 "3天后" 场次的 "成人票"
    Then 创建失败，提示参数不合法

  Scenario: 管理员可以查看所有订单列表
   Given 用户 "Alice" 已成功预订 1 张该展会的 "3天后" 场次的 "成人票"
    When 管理员查看订单列表
    Then 返回订单列表成功
     And 订单列表包含用户 "Alice" 的订单

  Scenario: 管理员可以查看单条订单详情
   Given 用户 "Alice" 已成功预订 1 张该展会的 "3天后" 场次的 "成人票"
    When 管理员查看该订单详情
    Then 返回订单详情成功
     And 订单包含用户信息
     And 订单包含 1 条订单项
     And 订单项为该展会的 "3天后" 场次的 "成人票"

  Scenario Outline: 除了未付款且没有过期的订单，其他状态的订单都可以隐藏
    Given 用户 "Alice" 有一笔 <订单状态> 的订单
     When 用户 "Alice" 隐藏该订单
     Then 隐藏成功
      And 订单列表中不再显示该订单
      And 管理员查看订单列表仍然可以看到该订单

    Examples:
      | 订单状态   |
      | 已取消     |
      | 已过期     |
      | 已完成     |
