Feature: manage exhibition

  Background:
    Given 系统管理员已经创建并登录

  Scenario: create a new exhibition
    Given 展览名称为 cr7_life_museum
      And 描述为 "welcome to cr7 life museum"
      And 开始日期为 "3天后"
      And 结束日期为 "60天后"
      And 开放时间为 "10:00"
      And 闭馆时间为 "18:00"
      And 最晚入场时间为 "15:30"
      And 地点为 "ShangHai"
    When 创建展览
    Then 展览创建成功且票种列表为空

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
     When 按 limit 2 和 offset 0 查询展览列表
     Then 返回 2 个展览
      And 展览按 created_at 倒序排列

  Scenario: list exhibitions with limit and offset
    Given 已为列表创建 3 个展览
     When 按 limit 1 和 offset 1 查询展览列表
     Then 返回 1 个展览
      And 返回的是第二个创建的展览

  Scenario: list exhibitions empty result
     When 按 limit 10 和 offset 1000 查询展览列表
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

# todo
# - 更新 exhibition 基本信息
# - 更新 ticket category
