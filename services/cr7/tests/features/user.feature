
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

  Scenario: 管理员添加新用户
    Given 管理员账号创建并登录

    Given 管理员新增用户 "Bob", 手机号为 "19876543210"，密码为 "user_pass_test"
     When 新用户使用手机号 "19876543210" 和密码 "user_pass_test" 登录
     Then 新用户信息包含手机号，国家码为 "86"，手机号为 "19876543210"，用户名为 "Bob"

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
    Given 管理员账号创建并登录
    Given 用户 "Alice" 已注册并登录

     When 管理员账号将用户 "Alice" 设置成运营人员
     When 用户 "Alice" 第 1 次查看个人的角色列表
      And 用户 "Alice" 的角色列表包含 "OPERATOR"，是系统内置角色，权限为空

  Scenario: 管理员可以查看用户列表
    Given 管理员账号已登录，手机号为 "12345678901"

     When 管理员账号获取用户列表
     Then 用户列表分页信息为 page 1、limit 20
     Then 用户列表获取成功，用户列表包含手机号为 "12345678901"，国别码 "86" 的用户

     When 管理员用手机号 "12345678901" 搜索用户列表
     Then 用户列表搜索成功，用户列表包含手机号为 "12345678901"，国别码 "86" 的用户

  Scenario: 系统角色管理
    Given 管理员账号创建并登录
    Given 用户 "Bob" 已注册并登录

     When 管理员获取角色列表
     Then 角色列表包含 "ADMIN" 和 "OPERATOR" 角色，都为系统内置角色

    Given 新角色 "TEST_ROLE"，描述为 "测试角色", 权限包含 "USER_MANAGE"
     When 管理员创建新角色
     Then 角色 "TEST_ROLE" 创建成功，并且在角色列表中, 权限包含 "USER_MANAGE"

    Given 角色 "TEST_ROLE" 的新名称为 "TEST_ROLE_NEW"，描述为 "新的测试角色", 新权限包含 "USER_MANAGE" 和 "CONTENT_MANAGE"
     When 管理员更新角色
     Then 角色 "TEST_ROLE_NEW" 更新成功，描述为 "新的测试角色"，权限包含 "USER_MANAGE" 和 "CONTENT_MANAGE"

     When 管理员删除角色 "TEST_ROLE_NEW"
     Then 角色 "TEST_ROLE_NEW" 删除成功，并且不在角色列表中

     When 管理员删除内置角色 "OPERATOR"
     Then 删除内置角色 "OPERATOR" 失败，返回错误提示内置角色不能删除

  Scenario: 将角色授予用户
    Given 管理员账号创建并登录
    Given 用户 "Bob" 已注册并登录

    Given 新角色 "Content manager"，描述为 "内容管理", 权限包含 "CONTENT_MANAGE"
    Given 新角色 "Customer service"，描述为 "客服", 权限包含 "CUSTOMER_SERVICE"
     When 管理员创建新角色

     When 管理员将角色 "Content manager" 授予用户 "Bob"
     Then 角色 "Content manager" 已成功授予用户 "Bob"
     When 用户 "Bob" 第 1 次查看个人的角色列表
      And 用户 "Bob" 的角色列表有 1 个，包含 "Content manager"，不是内置角色，权限包含 "CONTENT_MANAGE"

     When 管理员将角色 "Customer service" 授予用户 "Bob"
     Then 角色 "Customer service" 已成功授予用户 "Bob"
     When 用户 "Bob" 第 2 次查看个人的角色列表
      And 用户 "Bob" 的角色列表有 2 个，包含 "Customer service"，不是内置角色，权限包含 "CUSTOMER_SERVICE"
      And 用户 "Bob" 的角色列表同时包含 "Content manager"，不是内置角色，权限包含 "CONTENT_MANAGE"

     When 管理员将角色 "Content manager" 从用户 "Bob" 收回
     Then 角色 "Content manager" 已成功从用户 "Bob" 收回
     When 用户 "Bob" 第 3 次查看个人的角色列表
      And 用户 "Bob" 的角色列表有 1 个，包含 "Customer service"，不是内置角色，权限包含 "CUSTOMER_SERVICE"
      And 用户 "Bob" 的角色列表不包含 "Content manager"

  Scenario: 管理员不能删除自己的管理员角色
    Given 管理员账号创建并登录

     When 管理员为自己收回管理员角色 "ADMIN"
     Then 收回管理员角色 "ADMIN" 失败，返回错误提示内置角色不能删除

  Scenario: 使用角色过滤用户列表
    Given 管理员账号创建并登录
    Given 用户 "Alice" 已注册并登录
    Given 用户 "Bob" 已注册并登录
    Given 管理员账号将用户 "Alice" 设置成运营人员
    Given 管理员账号将用户 "Bob" 设置成客服人员

     When 管理员账号获取用户列表，角色过滤为 "OPERATOR"
     Then 用户列表获取成功，用户列表包含用户 "Alice"，角色为 "OPERATOR"
      And 用户列表获取成功，用户列表不包含用户 "Bob"

     When 管理员查看所有分配过任何角色的用户列表
     Then 用户列表获取成功，用户列表包含用户 "Alice" 和用户 "Bob"