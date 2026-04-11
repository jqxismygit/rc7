Feature: 对接携程 OTA

  Background:
    Given cr7 服务已启动
    Given 系统管理员已经创建并登录
    Given 用户 "Alice" 已注册并登录
    Given 默认核销展览活动已创建，开始时间为 "今天"，结束时间为 "2天后"
    Given 展会添加票种 "早鸟票", 准入人数为 1, 有效期为场次当天, 价格是 1.01 元
      And "早鸟票" 库存为 2
    Given 展会添加票种 "单人票", 准入人数为 1, 有效期为场次当天, 价格是 2.02 元
      And "单人票" 库存为 2

  Scenario: 管理员绑定门票到携程
     When 管理员在 "早鸟票" 上添加携程编号 "xc_early_bird"
     Then "早鸟票" 的 ota Option Id 被设置为 "xc_early_bird"

  Scenario: 管理员可以将门票的场次及价格同步到携程
    Given 携程服务已经准备好接受同步信息
    Given 当前同步类型为场次价格, 票种 "早鸟票"，场次开始时间为 "今天"，结束时间为 "2天后"
     When 管理员将场次票种同步给携程
     Then 携程接收到了场次价格同步信息
      And 可以正确解密
      And 包含 "3" 天的场次信息
      And 同步的场次起始时间为 "今天"
      And 同步的场次结束时间为 "2天后"
      And 售价为 1.01 元, 成本价为 1.01 元
      And supplier Option Id 是 "早鸟票" 的票种 ID
      And Service Name 是 "DatePriceModify"

  Scenario: 管理员可以查看门票的场次及价格同步记录
    Given 携程服务已经准备好接受同步信息
    Given 当前同步类型为场次价格, 票种 "早鸟票"，场次开始时间为 "今天"，结束时间为 "2天后"
     When 管理员将场次票种同步给携程
     Then 管理员可以查看 "早鸟票" 的携程价格同步记录
      And "早鸟票" 有 "1" 条携程价格同步记录
      And 同步结果为 "成功"
      And sequence Id 是同步信息中的 sequence Id
      And service Name 是 "DatePriceModify"
      And 场次有 "3" 个
      And 起始场次时间为 "今天"
      And 结束场次时间为 "2天后"
      And 售价为 1.01 元, 成本价为 1.01 元

  Scenario: 不能同步时间不在展会范围内的场次价格信息
    Given 当前同步类型为场次价格, 票种 "早鸟票"，场次开始时间为 "3天后"，结束时间为 "4天后"
     When 管理员将场次票种同步给携程
    Then 同步失败，错误信息包含 "同步的场次时间不在展会时间范围内"

  Scenario: 同步场次门票剩余库存到携程
    Given 携程服务已经准备好接受同步信息
    Given 当前同步类型为剩余库存
    Given 票种 "单人票"，场次开始时间为 "今天"，结束时间为 "2天后"
     When 管理员将场次票种的库存同步给携程
     Then 携程接收到了库存同步信息
      And 可以正确解密
      And 库存数量为 "单人票" 的剩余库存数量
      And ota Option Id 是 "单人票" 的携程编号 "xc_single_ticket"
      And supplier Option Id 是 "单人票" 的票种 ID
      And Service Name 是 "DateInventoryModify"
      And 同步结果为 "成功"
      And 同步的场次起始时间为 "今天"
      And 同步的场次结束时间为 "2天后"
      And 每个场次的库存数量为 "单人票" 的剩余库存数量

  Scenario: 同步场次门票指定库存到携程
    Given 携程服务已经准备好接受同步信息
    Given 当前同步类型为指定库存
      And 指定库存数量为 "1"
    Given 票种 "单人票"，场次开始时间为 "今天"，结束时间为 "2天后"
     When 管理员将场次票种的库存同步给携程
     Then 携程接收到了库存同步信息
      And 可以正确解密
      And 库存数量为 "1"

  Scenario: 管理员可以查看门票的库存同步记录
    Given 携程服务已经准备好接受同步信息
    Given 当前同步类型为剩余库存
    Given 票种 "单人票"，场次开始时间为 "今天"，结束时间为 "2天后"
     When 管理员将场次票种的库存同步给携程
     Then 管理员可以查看 "单人票" 的携程库存同步记录
      And "单人票" 有 "1" 条携程库存同步记录
      And 同步结果为 "成功"
      And sequence Id 是同步信息中的 sequence Id
      And service Name 是 "DateInventoryModify"
      And ota Option Id 是 "单人票" 的携程编号 "xc_single_ticket"
      And 场次有 "3" 个
      And 起始场次时间为 "今天"
      And 结束场次时间为 "2天后"
      And 每个场次的库存数量为 "单人票" 的剩余库存数量

  Scenario: 不能同步时间不在展会范围内的库存信息
    Given 当前同步类型为剩余库存
    Given 票种 "单人票"，场次开始时间为 "3天后"，结束时间为 "4天后"
     When 管理员将场次票种的库存同步给携程
     Then 同步失败，错误信息包含 "同步的场次时间不在展会时间范围内"

  Scenario: 不能同步库存数量超过实际剩余库存的库存信息
    Given 当前同步类型为指定库存
      And 指定库存数量为 "10"
    Given 票种 "单人票"，场次开始时间为 "今天"，结束时间为 "2天后"
     When 管理员将场次票种的库存同步给携程
     Then 同步失败，错误信息包含 "同步的库存数量超过实际剩余库存"
