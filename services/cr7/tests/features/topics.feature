Feature: Topics & Article

  Background:
    Given 系统管理员已经创建并登录
    Given 用户 "Alice" 已注册并登录

  Scenario: 管理员创建一个新的话题
    When 管理员创建话题，标题为 "展会亮点"
     And 描述为 "介绍展会的亮点和特色"
     And 话题的封面图片为 "http://example.com/cover.jpg"
    Then 话题创建成功
     And 话题的标题为 "展会亮点"
     And 话题的描述为 "介绍展会的亮点和特色"
     And 话题的封面图片为 "http://example.com/cover.jpg"

  Scenario: 管理员修改话题信息
    Given 话题 "展会亮点" 已创建
    When 管理员修改话题的描述为 "更新后的话题描述"
     And 话题的封面图片为 "http://example.com/new_cover.jpg"
    Then 话题修改成功
     And 话题的描述为 "更新后的话题描述"
     And 话题的封面图片为 "http://example.com/new_cover.jpg"

  Scenario: 管理员在话题下发布文章
    Given 话题 "展会亮点" 已创建
    When 文章 "必看展位" 添加在话题 "展会亮点" 下
     And 文章内容为 "介绍必看的展位和产品"
     And 文章的封面图片为 "http://example.com/article_cover.jpg"
    Then 文章发布成功
    When 用户查看文章详情
    Then 文章的标题为 "必看展位"
     And 文章的内容为 "介绍必看的展位和产品"
     And 文章属于话题 "展会亮点"

  Scenario: 管理员修改文章内容
    Given 文章 "必看展位" 已发布在话题 "展会亮点" 下
    When 管理员修改文章的内容为 "更新后的文章内容，介绍更多必看的展位和产品"
     And 修改文章的封面图片为 "http://example.com/new_article_cover.jpg"
    Then 文章修改成功
     And 文章的内容为 "更新后的文章内容，介绍更多必看的展位和产品"
     And 文章的封面图片为 "http://example.com/new_article_cover.jpg"

  Scenario: 用户查看 topics 列表
    Given 话题 "展会亮点" 已创建
      And 话题的描述为 "话题描述"
      And 话题的封面图片为 "http://example.com/cover.jpg"
    Given 文章 "必看展位" 添加在话题 "展会亮点" 下
      And 文章内容为 "介绍必看的展位和产品"
      And 文章的封面图片为 "http://example.com/article_cover.jpg"
     Then 文章发布成功
     When 用户查看话题列表
     Then 可以看到话题 "展会亮点"
      And 话题的描述为 "话题描述"
      And 话题的封面图片为 "http://example.com/cover.jpg"
      And 话题下有 "1" 篇文章
      And 文章标题为 "必看展位"
      And 文章内容为 "介绍必看的展位和产品"
      And 文章的封面图片为 "http://example.com/article_cover.jpg"

  Scenario: 管理员删除文章
    Given 文章 "必看展位" 已发布在话题 "展会亮点" 下
    When 管理员删除文章 "必看展位"
    Then 文章删除成功
     And 文章 "必看展位" 不存在

  Scenario: 管理员删除话题
    Given 话题 "展会亮点" 已创建
    When 管理员删除话题 "展会亮点"
    Then 话题删除成功
     And 话题 "展会亮点" 不存在

  Scenario: 管理员可以上传图片
    When 管理员上传图片
     And 图片文件名为 "test_image.jpg"
    Then 图片上传成功
     And 图片 URL 包含为 "/data/<uuid>.webp"