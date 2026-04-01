Feature: 对接携程 OTA 订单系统

  Background:
    Given 系统管理员已经创建并登录

    Given 默认核销展览活动已创建，开始时间为 "今天"，结束时间为 "2天后"
    Given 展会添加票种 "早鸟票", 准入人数为 1, 有效期为场次当天
      And "早鸟票" 库存为 2
    Given 展会添加票种 "单人票", 准入人数为 1, 有效期为场次当天
      And "单人票" 库存为 2

    Given 用户在携程上创建了一个订单
      And 携程订单的包含 "早鸟票" 1 张，场次时间为 "今天"
      And 携程订单的总价为 "早鸟票" 的价格
      And 携程订单的购买人姓名是 "Alice_xc"
      And 携程订单的购买人手机号是 "13800138000"，国别码为 "+86"
      And 携程订单信息中的 service name 是 "CreatePreOrder"
      And 携程订单中的 PLU id 是 cr7 系统中 "早鸟票" 的 ID
      And 携程订单号是 "xc_order_12345"
      And 携程 sequence id 是 "xc_seq_12345"

  Scenario: 用户从携程下单购买门票
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
    Then cr7 新整增加了用户 "Alice_xc" 的账号, 手机号是 "13800138000"，国别码为 "+86"
     And 订单应包含 "早鸟票" 1 张，场次时间为 "今天"
     And 订单总价应为 "早鸟票" 的价格
     And 订单状态为 "待支付"
     And 订单的来源是 "携程"
     And 订单的购买人姓名是 "Alice_xc"
    Then cr7 系统按照携程的要求返回订单创建成功的响应

  Scenario: 携程重复发送同一个订单
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
    Then cr7 新整增加了用户 "Alice_xc" 的账号, 手机号是 "13800138000"，国别码为 "+86"
    Then cr7 系统按照携程的要求返回订单创建成功的响应
    When 携程重复发送同样的订单创建请求
     And 携程订单号是 "xc_order_12345"
     And 携程 sequence id 是 "xc_seq_54321"
    Then cr7 系统再次收到订单创建通知
     And 再次收到的订单信息可以正常解密
    Then cr7 系统再次按照携程的要求返回订单创建成功的响应
    Then 用户 "Alice_xc" 只有一个账号
    Then cr7 系统只有一个订单，订单号是 "xc_order_12345"，订单状态为 "待支付"

  Scenario: 管理员可以查看单条携程订单同步记录
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then 管理员在系统后台可以获取订单号 "xc_order_12345" 的携程同步记录
     And 同步记录内容包含订单号 "xc_order_12345"，序列号 "xc_seq_12345", 同步状态为 "成功"
     And 同步记录中包含手机号 "13800138000"，国别码 "+86"
     And 同步记录中包含 "早鸟票" 1 张，场次时间为 "今天"
     And 同步记录中包含订单总价 "早鸟票" 的价格
    When 携程再次发送订单创建通知
     And 携程订单号是 "xc_order_12345"
     And 携程 sequence id 是 "xc_seq_54321"
    Then 管理员在系统后台可以获取订单号 "xc_order_12345" 的携程最新同步记录
     And 同步记录内容包含订单号 "xc_order_12345",序列号 "xc_seq_54321", 同步状态为 "重复订单"
    And 最新的同步记录中的 order id 和第一次同步记录中的 order id 保持一致

  Scenario: 用户从携程下单购买门票，订单信息被篡改
    When cr7 系统收到订单创建通知
    Then cr7 系统无法解密订单信息
     And cr7 系统按照携程的要求返回订单创建失败的响应

  Scenario: 用户在携程下单后，可以查询订单详情
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
     And 订单详情包含 "早鸟票" 1 张，场次时间为 "今天"
     And 订单 ota order id 是 "xc_order_12345"
    Then cr7 创建了一个订单
     And 携程发来了 service name 是 "QueryOrder" 的订单查询请求
     And 携程订单查询请求中的 ota order id 是 "xc_order_12345"
     And 携程订单中的 supplier order id 是 cr7 订单 id
    Then cr7 系统按照携程的要求返回订单查询响应
     And 订单查询响应中包含 supplier order id
     And 订单查询响应中包含 ota order id "xc_order_12345"
     And 订单查询响应中包含 item id 为票种 id 的订单项，数量为 1
     And 订单查询响应中包含 use start date 和 use end date 分别为 "今天" 的开始和结束时间
     And 订单查询响应中包含订单状态 "新订待确认" 值为 1

