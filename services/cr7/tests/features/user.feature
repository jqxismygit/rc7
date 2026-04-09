
Feature: user registration and login

  Background:
    Given cr7 服务已启动

  Scenario: 微信用户登录
    Given 微信小程序服务已经准备好
     When 微信 用户_1 首次打开小程序
     Then 注册为新用户
     When 微信 用户_1 再次打开小程序
     Then 登录成功并获取用户信息

  Scenario: 初始化系统管理员账号
    Given 使用 cli 初始化管理员账号，指定手机号 "12345678901"，密码为 "pass_test"
     Then 管理员账号创建成功
      And 管理员账号的手机号为 "+86" "12345678901"
      And 管理员的用户名默认为 "system admin"

  Scenario: 管理员账号登录
    Given 管理员账号 "system admin" 已创建，手机号为 "12345678901"，密码为 "pass_test"
     When 管理员账号 "system admin" 登录
     Then 登录成功并获取管理员用户信息

  Scenario: 管理员账号修改密码
    Given 管理员账号 "system admin" 已登录，手机号为 "12345678901"，密码为 "pass_test"
     When 管理员账号 "system admin" 修改密码为 "newpassword"
     Then 密码修改成功
      And 管理员账号 "system admin" 使用新密码 "newpassword" 登录成功
      And 管理员账号 "system admin" 使用旧密码 "pass_test" 登录失败

  Scenario: 管理员可以将其他用户设置成运营人员
    Given 管理员账号 "system admin" 已登录
    Given 用户 "Alice" 已注册并登录
     When 管理员账号 "system admin" 将用户 "Alice" 设置成运营人员
     Then 用户 "Alice" 的角色包含 "operator"

  Scenario: 管理员可以查看用户列表
    Given 管理员账号 "system admin" 已登录，手机号为 "12345678901"，密码为 "pass_test"
     When 管理员账号 "system admin" 获取用户列表
     Then 用户列表分页信息为 page 1、limit 20
     Then 获取成功，用户列表包含用户 "system admin"
      And "system admin" 的手机号为 "+86" "12345678901"
     When 管理员用手机号 "12345678901" 搜索用户列表
     Then 搜索成功，用户列表包含用户 "system admin"
      And 搜索结果中 "system admin" 的手机号为 "+86" "12345678901"
     When 管理员按 page 1、limit 1 获取用户列表
     Then 分页查询返回 page 1、limit 1
      And 分页结果数量不超过 1
