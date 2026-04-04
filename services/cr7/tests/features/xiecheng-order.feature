Feature: 对接携程 OTA 订单系统

  Background:
    Given cr7 服务已启动
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
     And 订单的来源是携程
     And 订单的购买人姓名是 "Alice_xc"
    Then cr7 系统按照携程的要求返回订单创建成功的响应
    Then 管理员查看场次 "今天" 的 "早鸟票" 库存应该是 1

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
    Then cr7 系统只有一个订单, cr7 订单号不变, 订单状态不变
     And 订单的用户账号不变
    Then cr7 系统再次按照携程的要求返回订单创建成功的响应

  Scenario: 管理员可以查看单条携程订单同步记录
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
    Then 管理员在系统后台可以获取订单号 "xc_order_12345" 的携程同步记录
     And 同步记录内容包含订单号 "xc_order_12345"，序列号 "xc_seq_12345", 同步状态是成功
     And 同步记录中包含手机号 "13800138000"，国别码 "+86"
     And 同步记录中包含 "早鸟票" 1 张，场次时间为 "今天"
     And 同步记录中包含订单总价 "早鸟票" 的价格
    When 携程再次发送订单创建通知, 订单号是 "xc_order_12345", sequence id 是 "xc_seq_54321"
    Then 管理员在系统后台可以获取订单号 "xc_order_12345" 的携程最新同步记录
     And 同步记录内容包含订单号 "xc_order_12345",序列号 "xc_seq_54321", 同步状态为重复订单
    And 最新的同步记录中的 order id 和第一次同步记录中的 order id 保持一致

  Scenario: 用户从携程下单购买门票，订单信息被篡改
    When cr7 系统收到订单创建通知
    Then cr7 系统无法解密订单信息
     And cr7 系统按照携程的要求返回订单创建失败的响应

  Scenario: 用户在携程下单后，可以查询订单详情
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
   Given 携程 service name 是 "QueryOrder" 的订单查询请求
     And 携程订单查询请求中的 ota order id 是 "xc_order_12345"
     And 携程订单查询请求中的 supplier order id 是 cr7 订单 id
    When 携程发送订单查询请求
    Then cr7 系统按照携程的要求返回订单查询响应
     And 订单查询响应中包含 supplier order id
     And 订单查询响应中包含 ota order id "xc_order_12345"
     And 订单查询响应中包含 1 个 的订单项，其数量为 1
     And 订单查询响应中订单项的 item id 因为订单还没有支付，所以为 0
     And 订单查询响应中订单项的实际使用份数是 0
     And 订单查询响应中包含 use start date 和 use end date 分别为 "今天" 的开始和结束时间
     And 订单查询响应中包含订单状态 "待付款" 值为 11

  Scenario: 用户在携程下单后，查询订单详情时订单号不存在
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
   Given 携程 service name 是 "QueryOrder" 的订单查询请求
     And 携程订单查询请求中的 ota order id 是 "xc_order_54321_not_exist"
     And 携程订单查询请求中的 supplier order id 是 cr7 订单 id
    When 携程发送订单查询请求
    Then cr7 系统按照携程的要求返回订单查询响应
     And 订单查询响应中响应码为 "4001"，订单不存在

  Scenario: 用户在携程下单后，取消了订单
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
   Given 携程 service name 是 "CancelPreOrder" 的订单取消请求
     And 携程订单取消请求中的 ota order id 是 "xc_order_12345"
     And 携程订单取消请求中的 sequence id 是 "xc_cancel_order_seq_12345"
    When 携程发送订单取消请求
    Then cr7 系统按照携程的要求返回订单取消响应
     And 订单取消响应中包含 supplier order id
     And 订单取消响应中包含 ota order id "xc_order_12345"
     And 订单取消响应中订单状态为已取消，值为 14
    When 管理员在系统后台查询订单号 "xc_order_12345" 的携程同步记录
     And 同步记录内容包含订单号 "xc_order_12345"，序列号 "xc_cancel_order_seq_12345", 同步状态是成功
     And 同步记录中的 supplier order id 是用户创建的订单 id
     And 同步记录中包含订单状态变更为已取消，值为 14

  Scenario: 用户取消在携程的订单，但是 ota 号不存在
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
   Given 携程 service name 是 "CancelPreOrder" 的订单取消请求
     And 携程订单取消请求中的 ota order id 是 "xc_order_54321_not_exist"
     And 携程订单取消请求中的 sequence id 是 "xc_cancel_order_seq_54321"
    When 携程发送订单取消请求
    Then cr7 系统按照携程的要求返回订单取消响应
     And 订单取消响应中响应码为 "2001"，订单不存在

  Scenario: 用户完成支付携程下单的门票订单
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
  Given 携程 service name 是 "PayPreOrder" 的订单支付请求
     And 携程订单支付请求中的 supplier order id 是用户创建的订单 id
     And 携程订单支付请求中的 ota order id 是 "xc_order_12345"
     And 携程订单支付请求中的 sequence id 是 "xc_pay_order_seq_12345"
     And 携程订单支付请求中的订单项 id 是 "xc_item_12345"
     And 携程订单支付请求中的 items.0.PLU 是 "早鸟票" 的 id
    When 携程发送订单支付请求
    Then cr7 系统按照携程的要求返回订单支付响应
     And 订单支付响应中包含 supplier order id
     And 订单支付响应中包含 ota order id "xc_order_12345"
     And 订单支付响应中包含 supplier confirm type 是 1
     And 订单支付响应中的凭证发送方是携程，值为 1
     And 订单支付响应中的凭证类型是二维码图片，值为 3
     And 订单支付响应中的凭证 id 是订单核销码 id
     And 订单支付响应中的凭证 code 是订单核销码
     And 订单支付响应中的凭证数据是订单核销码
     And 订单支付响应中的订单项 id 是 "xc_item_12345"
     And 订单支付响应中的票据信息和出行凭证无关
     And 订单支付响应中订单状态为已支付，值为 13
    When 管理员在系统后台查询订单号 "xc_order_12345" 的携程同步记录
     And 同步记录内容包含订单号 "xc_order_12345"，序列号 "xc_pay_order_seq_12345", 同步状态是成功
     And 同步记录中的 supplier order id 是用户创建的订单 id
     And 同步记录中包含订单状态变更为已支付，值为 13
   Given 携程 service name 是 "QueryOrder" 的订单查询请求
     And 携程订单查询请求中的 ota order id 是 "xc_order_12345"
     And 携程订单查询请求中的 supplier order id 是 cr7 订单 id
    When 携程发送订单查询请求
    Then cr7 系统按照携程的要求返回订单查询响应
     And 订单查询响应中包含 1 个 的订单项，其数量为 1
     And 订单查询响应中订单项的 item id 因为订单已经支付过，所以为 "xc_item_12345"
     And 订单查询响应中订单项的实际使用份数是 0

  Scenario: 用户在携程下单后，完成支付后又取消了订单
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
    Then 管理员查看场次 "今天" 的 "早鸟票" 库存应该是 1
   Given 携程 service name 是 "PayPreOrder" 的订单支付请求
     And 携程订单支付请求中的订单项 id 是 "xc_item_12345"
    When 携程发送订单支付请求
    Then cr7 系统按照携程的要求返回订单支付响应
     And 订单支付响应中订单状态为已支付，值为 13
   Given 携程 service name 是 "CancelOrder" 的订单退款请求
     And 订单退款请求里的 supplier order id 是用户创建的订单 id
     And 订单退款请求里的 ota order id 是 "xc_order_12345"
     And 订单退款请求里的订单项 id 是 "xc_item_12345"
    When 携程发送订单退款请求
    Then cr7 系统按照携程的要求返回订单退款响应
     And 订单退款响应中 supplier confirm type 为 取消已确认，值为 1
     And 订单退款响应中订单项 id 是 "xc_item_12345"
     And 订单退款响应中的凭证 id 为订单核销码 id
    Then 订单状态变为已退款
    When 管理员在系统后台查询订单号 "xc_order_12345" 的携程同步记录
     And 同步记录内容包含订单号 "xc_order_12345"，序列号 "xc_cancel_order_seq_54321", 同步状态是成功
     And 同步记录中的 supplier order id 是用户创建的订单 id
    Then 管理员查看场次 "今天" 的 "早鸟票" 库存应该是 2
   Given 携程 service name 是 "QueryOrder" 的订单查询请求
     And 携程订单查询请求中的 ota order id 是 "xc_order_12345"
     And 携程订单查询请求中的 supplier order id 是 cr7 订单 id
    When 携程发送订单查询请求
    Then cr7 系统按照携程的要求返回订单查询响应
     And 订单查询响应中包含 1 个 的订单项，其数量为 1
     And 订单查询响应中订单项的 item id 因为订单已经支付过，所以为 "xc_item_12345"
     And 订单查询响应中订单状态为全部取消，值为 5

  Scenario: 用户在携程下单后，完成支付后又取消了订单，但是订单不存在
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
   Given 携程 service name 是 "PayPreOrder" 的订单支付请求
     And 携程订单支付请求中的订单项 id 是 "xc_item_12345"
    When 携程发送订单支付请求
    Then cr7 系统按照携程的要求返回订单支付响应
     And 订单支付响应中订单状态为已支付，值为 13
   Given 携程 service name 是 "CancelOrder" 的订单退款请求
     And 订单退款请求里的 supplier order id 是用户创建的订单 id
     And 订单退款请求里的 ota order id 是 "xc_order_54321_not_exist"
     And 订单退款请求里的订单项 id 是 "xc_item_12345"
    When 携程发送订单退款请求
    Then cr7 系统按照携程的要求返回订单退款响应
     And 订单退款响应中响应码为 "2001"，订单不存在
    Then 管理员查看场次 "今天" 的 "早鸟票" 库存应该是 1

  Scenario: 用户在携程下单后，完成支付后又取消了订单，但是票的数量不正确
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
   Given 携程 service name 是 "PayPreOrder" 的订单支付请求
     And 携程订单支付请求中的订单项 id 是 "xc_item_12345"
    When 携程发送订单支付请求
    Then cr7 系统按照携程的要求返回订单支付响应
     And 订单支付响应中订单状态为已支付，值为 13
   Given 携程 service name 是 "CancelOrder" 的订单退款请求
     And 订单退款请求里的 supplier order id 是用户创建的订单 id
     And 订单退款请求里的 ota order id 是 "xc_order_12345"
     And 订单退款请求里的订单项 id 是 "xc_item_12345"
     And 订单退款请求里的订单项数量是 2
    When 携程发送订单退款请求
    Then cr7 系统按照携程的要求返回订单退款响应
     And 订单退款响应中响应码为 "2004"，取消数量不正确
    Then 管理员查看场次 "今天" 的 "早鸟票" 库存应该是 1

  Scenario: 核销用户在携程上购买的门票
    When 用户提交订单
    Then cr7 系统收到订单创建通知
     And 订单信息可以正常解密
    Then cr7 创建了一个订单
   Given 携程 service name 是 "PayPreOrder" 的订单支付请求
     And 携程订单支付请求中的订单项 id 是 "xc_item_12345"
    When 携程发送订单支付请求
    Then cr7 系统按照携程的要求返回订单支付响应
     And 订单支付响应中订单状态为已支付，值为 13
   Given 携程服务已经准备好接受核销通知
    When "管理员" 核销了订单
    Then 携程服务收到了订单核销通知
     And 核销通知中的 sequence id 是 cr7 核销记录的 id
     And 核销通知中的 ota order id 是 "xc_order_12345"
     And 核销通知中的 supplier order id 是用户创建的订单 id
     And 核销通知中包含订单项 id "xc_item_12345"
     And 核销通知中订单项的数量是购票数量
     And 核销通知中订单项的使用数量是购票数量
     And 核销通知中订单项的 use start date 和 use end date 都为 "今天"
   Given 携程 service name 是 "QueryOrder" 的订单查询请求
     And 携程订单查询请求中的 ota order id 是 "xc_order_12345"
     And 携程订单查询请求中的 supplier order id 是 cr7 订单 id
    When 携程发送订单查询请求
    Then cr7 系统按照携程的要求返回订单查询响应
     And 订单查询响应中的订单项的实际使用份数是购票数量
     And 订单查询响应中订单项的 use start date 和 use end date 都为 "今天"
     And 订单查询响应中包含 1 个 的订单项，其数量为 1
     And 订单查询响应中订单项的 item id 因为订单已经支付过，所以为 "xc_item_12345"
     And 订单查询响应中订单的状态是全部使用，值为 8
   Given 携程 service name 是 "CancelOrder" 的订单退款请求
     And 订单退款请求里的 supplier order id 是用户创建的订单 id
     And 订单退款请求里的 ota order id 是 "xc_order_12345"
     And 订单退款请求里的订单项 id 是 "xc_item_12345"
    When 携程发送订单退款请求
    Then 退款失败，订单已经使用，返回码 "2002"