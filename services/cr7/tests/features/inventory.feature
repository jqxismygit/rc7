Feature: manage inventory

  Background:
    Given cr7 服务已启动
    Given 系统管理员已经创建并登录
    Given 已创建一个包含 2 个场次的展览
    Given 已为该展览创建 2 个票种

  Scenario: view inventory of a session
    Given 场次库存已准备完成
     When 查看该场次的库存
     Then 该场次下所有票种库存默认都为 0

  Scenario: 可以一次更新 exhibition 下某个 ticket category 所有 session 的 inventory
    Given 已将票种 "early_bird" 在该展览所有场次的库存设置为 50
     When 更新票种 "early_bird" 在该展览所有场次的库存
     Then 票种 "early_bird" 在该展览所有场次的库存应为 50
      And 另一票种 "regular" 在该展览所有场次的库存应仍为 0

  Scenario: 可以查看 一个 session 下所有 ticket category 的 inventory
    Given 已将票种 "early_bird" 在该展览首场次的库存设置为 30
      And 并将票种 "regular" 在该展览首场次的库存设置为 20
     When 查看该展览首场次的库存
     Then 票种 "early_bird" 在该展览首场次的库存应为 30
      And 另一票种 "regular" 在该展览首场次的库存应为 20

  Scenario: non-admin user cannot update inventory
    Given 普通用户已登录
    When 普通用户尝试更新票种库存
    Then 返回权限不足错误

