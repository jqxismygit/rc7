Feature: Assets

  Background:
    Given 系统管理员已经创建并登录

  Scenario: 管理员可以上传图片
    When 管理员上传图片
     And 图片文件名为 "test_image.jpg"
    Then 图片上传成功
     And 图片 URL 的前缀是配置中的 assets.base_url
     And 图片被转换成了 webp 格式
     And 图片 URL 的后缀是 ".webp"

  Scenario: 管理员可以上传视频
    Given 已准备视频文件 "test_video.mp4"
     When 视频上传成功
     Then 视频 URL 的前缀是配置中的 assets.base_url
      And 视频 URL 的后缀是 ".mp4"
