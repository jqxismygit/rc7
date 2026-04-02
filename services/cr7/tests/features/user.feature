
Feature: user registration and login
  Scenario: wechat user login
    Given wechat mini app
    When wechat user_1 first open
    Then register as a new user
    When wechat user_1 open again
    Then login successfully and get user profile

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
    Then 获取成功，用户列表包含用户 "system admin"
     And "system admin" 的手机号为 "+86" "12345678901"
    When 管理员用手机号 "12345678901" 搜索用户列表
    Then 获取成功，用户列表包含用户 "system admin"
     And "system admin" 的手机号为 "+86" "12345678901"
