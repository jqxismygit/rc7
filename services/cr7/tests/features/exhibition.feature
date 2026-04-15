Feature: manage exhibition

  Background:
    Given cr7 服务已启动
    Given 系统管理员已经创建并登录

  Scenario: create a new exhibition
    Given 展览名称为 cr7_life_museum
      And 展会描述为 "welcome to cr7 life museum"
      And 展会开始日期为 "3天后"
      And 展会结束日期为 "60天后"
      And 展会开放时间为 "10:00"
      And 展会闭馆时间为 "18:00"
      And 展会最晚入场时间为 "15:30"
      And 展会城市为 "上海"
      And 展会场馆名称为 "上海展览中心"
      And 展会地点为 "ShangHai"
      And 展会封面图为 "https://example.com/cr7_life_museum.jpg"
     When 创建展览
     Then 展览创建成功且票种列表为空
      And 展览状态默认为下线

  Scenario: admin can update exhibition status by dedicated route
    Given 已创建展览
     When 管理员将展览状态更新为 "ENABLE"
     Then 展览状态更新为 "ENABLE"
     When 管理员再次将展览状态更新为 "DISABLE"
     Then 展览状态再次更新为 "DISABLE"

  Scenario: sessions was created when exhibition was created
    Given 已创建展览
     Then 展览默认按天创建场次
      And 首个场次日期与展览开始日期一致
      And 最后场次日期与展览结束日期一致
      And 场次数量等于展览持续天数

  Scenario: add non-refundable ticket category to exhibition
    Given 已创建展览
    Given 为该展览准备票种草稿 "early_bird"
      And 票价为 100
      And 有效期为 1 天
      And 退票策略为不可退
      And 准入人数为 1
     When 向展览添加票种
     Then 票种 "early_bird" 添加成功
      And 展览包含 1 个票种 "early_bird"

  Scenario: add a refundable ticket category
    Given 已创建展览
    Given 为该展览准备票种草稿 "regular"
      And 票价为 150
      And 有效期为 10 天
      And 退票策略为场次前 48 小时可退
      And 准入人数为 2
     When 向展览添加票种
     Then 票种 "regular" 添加成功
      And 展览包含 1 个票种 "regular"

  Scenario: list exhibitions with pagination
    Given 已为列表创建 3 个展览
     When 按 limit 2 和 offset 0 查询管理员展览列表
     Then 返回 2 个展览
      And 展览按 created_at 倒序排列

  Scenario: list exhibitions with limit and offset
    Given 已为列表创建 3 个展览
     When 按 limit 1 和 offset 1 查询管理员展览列表
     Then 返回 1 个展览
      And 返回的是第二个创建的展览

  Scenario: list exhibitions only returns enabled records
    Given 已为列表创建 3 个展览
      And 管理员将第 2 个展览状态更新为 "ENABLE"
     When 按 limit 10 和 offset 0 查询展览列表
     Then 返回 1 个展览
      And 返回的是第 2 个创建的展览

  Scenario: list exhibitions empty result
     When 按 limit 10 和 offset 1000 查询管理员展览列表
     Then 返回 0 个展览

  Scenario: non-admin user cannot create exhibition
    Given 普通用户已登录
    When 普通用户尝试创建展览，名称为 "unauthorized_exhibition"
    Then 返回权限不足错误

  Scenario: non-admin user cannot add ticket category to exhibition
    Given 管理员已创建展览
    Given 普通用户已登录
    When 普通用户尝试为展览添加票种
    Then 返回权限不足错误

  Scenario: 可以更新展览的基本信息
    Given 展览名称为 "cr7_museum_to_update"
      And 展会描述为 "welcome to cr7 life museum"
      And 展会开始日期为 "3天后"
      And 展会结束日期为 "60天后"
      And 展会开放时间为 "10:00"
      And 展会闭馆时间为 "18:00"
      And 展会最晚入场时间为 "15:30"
      And 展会城市为 "上海"
      And 展会场馆名称为 "上海展览中心"
      And 展会地点为 "ShangHai"
      And 展会封面图为 "https://example.com/cr7_life_museum.jpg"
     When 创建展览
     Then 展览创建成功
    Given 准备更新展览名称为 "updated_cr7_life_museum"
      And 准备更新展会描述为 "updated description"
      And 准备更新展会开放时间为 "09:00"
      And 准备更新展会闭馆时间为 "17:00"
      And 准备更新展会最晚入场时间为 "16:00"
      And 准备更新展会地点为 "Beijing"
      And 准备更新展会城市为 "北京"
      And 准备更新展会场馆名称为 "北京展览中心"
      And 准备更新展会封面图为 "https://example.com/updated_cr7_life_museum.jpg"
     When 更新展览信息
     Then 展览描述更新成功

  Scenario: 更新展览时必须至少提供一个参数
    Given 已创建展览
     When 不提供任何参数更新展览
     Then 返回参数不合法错误

  Scenario: 更新展览时不能修改开始和结束日期
    Given 已创建展览
     When 尝试更新展览开始和结束日期
     Then 返回参数不合法错误

  Scenario: 可以更新票种信息
    Given 已创建展览
      And 已为该展览创建票种 "regular"
      And 准备更新票种名称为 "vip"
      And 准备更新票种价格为 199
      And 准备更新票种有效期为 30 天
      And 准备更新票种退票策略为不可退
      And 准备更新票种准入人数为 4

     When 更新票种信息
     Then 票种信息更新成功
      And 展览中的票种已更新为 "vip"

  Scenario: 更新票种时必须至少提供一个参数
    Given 已创建展览
      And 已为该展览创建票种 "regular"
     When 不提供任何参数更新票种
     Then 返回参数不合法错误
