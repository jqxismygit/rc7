
Feature: user registration and login
  Background:
    Given cr7 服务已启动

  Scenario: 微信用户登录
     When 微信用户 "wechat_mp_user" 首次打开小程序
     Then 注册为新用户
     When 微信用户 "wechat_mp_user" 再次打开小程序
     Then 登录成功并获取用户信息

  Scenario: 用户更新个人信息
    When 微信用户 "wechat_mp_user" 首次打开小程序
    Then 注册为新用户

   Given 用户新名称为 "新昵称"
     And 用户新的头像 "https://example.com/new-avatar.jpg"
     And 用户新的 profile 中有 "性别"，值为 "男"
     And 用户新的 profile 中有 "年龄"，值为 30
    When 用户更新个人信息
    Then 用户信息更新成功
    When 用户获取新的个人信息
    Then 用户信息名称为 "新昵称"
     And 用户信息头像为 "https://example.com/new-avatar.jpg"
     And 用户信息 profile 中 "性别" 的值为 "男"
     And 用户信息 profile 中 "年龄" 的值为 30

  Scenario: 微信用户绑定手机号
     When 微信用户 "wechat_mp_user" 首次打开小程序
     Then 注册为新用户
     When 用户点击手机号授权, 国家码为 "86"，手机号为 "12345678901"
     Then 微信服务端返回用户的手机号信息
     Then 微信用户已经与手机号绑定
      And 获取到的用户信息包含手机号，国家码为 "86"，手机号为 "12345678901"

  Scenario: 初始化系统管理员账号
    Given 使用 cli 初始化管理员账号，指定手机号 "12345678901"，密码为 "pass_test"
     Then 管理员账号创建成功
      And 管理员账号的手机号为 "+86" "12345678901"
      And 管理员的用户名默认为 "system admin"

  Scenario: 管理员账号登录
    Given 管理员账号已创建，手机号为 "12345678901"，密码为 "pass_test"
     When 管理员使用账号 "12345678901" 密码 "pass_test" 登录
     Then 登录成功并获取管理员用户信息

     When 管理员账号修改密码为 "newpassword"
     Then 管理员账号使用新密码 "newpassword" 登录成功
      And 管理员账号使用旧密码 "pass_test" 登录失败

  Scenario: 管理员可以将其他用户设置成运营人员
    Given 管理员账号已登录
    Given 用户 "Alice" 已注册并登录
     When 管理员账号将用户 "Alice" 设置成运营人员
     Then 用户 "Alice" 的角色包含 "operator"

  Scenario: 管理员可以查看用户列表
    Given 管理员账号已登录，手机号为 "12345678901"

     When 管理员账号获取用户列表
     Then 用户列表分页信息为 page 1、limit 20
     Then 用户列表获取成功，用户列表包含手机号为 "12345678901"，国别码 "86" 的用户

     When 管理员用手机号 "12345678901" 搜索用户列表
     Then 用户列表搜索成功，用户列表包含手机号为 "12345678901"，国别码 "86" 的用户
