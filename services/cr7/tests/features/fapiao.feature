Feature: 为订单开发票

  Background:
    Given cr7 服务已启动
    Given 系统管理员已经创建并登录

    Given 默认核销展览活动已创建，开始时间为 "今天"，结束时间为 "2天后"
    Given 展会添加票种 "单人票", 准入人数为 1, 有效期为场次当天, 价格是 103 元
      And 票种 "单人票" 库存为 2

    Given 用户已经通过微信绑定手机号，手机号为 "12345678901"，国别码为 "886"
      And 用户预订 2 张该展会的 "今天" 场次的 "单人票"
      And 用户发起并完成微信支付
      And 订单状态为已支付

    Given 发票服务已经启动

  Scenario: 用户成功申请发票
    When 用户申请订单的发票，发票抬头为 "测试公司"，税号为 "123456789", 邮箱为 "send_me_invoice@example.com"
    Then 发票服务接收到发票开具请求, 可以正常解密出发票申请信息
     And 请求中 interface code 是 "GP_FPKJ"
     And 请求中 interface 是 "REQUEST_COMMON_FPKJ"
     And 请求中流水号前缀是 "JZWLJC"，后缀是发票开具记录的 ID pad 到 14 位
     And 请求中设备类型是数电，值为 "6"
     And 请求中发票类型代码是数电普票，值为 "030"
     And 请求中发票类型是蓝字发票，值为 "0"
     And 请求中征税方式是普通征税，值为 "0"
     And 请求中销售方纳税人识别号是配置中的 tax_id
     And 请求中销售方名称是配置中的 company_name， 销售方地址是配置中的 company_address，销售方电话是配置中的 company_phone
     And 请求中销售方开户行是配置中的 company_bank，银行账号是配置中的 company_bank_account
     And 请求中开票人是配置中的 issuer
     And 请求中购买方名称是 "测试公司", 购买方纳税人识别号是 "123456789"，电子邮箱是 "send_me_invoice@example.com"
     And 请求中价税合计是 206 元，合计金额是 200 元，合计税额是 6 元
     And 请求中有 1 个发票行项目
     And 发票行项目的第 1 行的发票行性质是正常行，值为 "0"
     And 发票行项目的第 1 行的商品编码是 "3070301000000000000"
     And 发票行项目的第 1 行的项目名称是 "单人票", 数量是 2，单价是 103 元
     And 发票行项目的第 1 行的税率是 3%， 税额是 6 元

   Given 发票平台返回发票开具成功的响应， 值为 "0000"
     And 发票开具结果中流水号是 cr7 生成的流水号
     And 发票开具结果中的 PDF URL 是 "https://example.com/invoice.pdf"
     And 发票开具结果中的发票号码是 "fapiao1234567890"
    When 发票服务返回开具结果给 cr7

    When 用户查看发票申请列表
    Then 发票申请列表有 1 条记录
     And 该记录的订单 ID 是用户预订的订单 ID
     And 该记录的发票抬头是 "测试公司"
     And 该记录的税号是 "123456789"
     And 该记录的邮箱是 "send_me_invoice@example.com"
     And 该记录的状态是开具成功
     And 该记录的发票号码是 "fapiao1234567890"
     And 该记录的 PDF URL 是 "https://example.com/invoice.pdf"

    When 用户再次申请同一订单的发票
    Then cr7 返回错误，提示该订单的发票已经开具成功

