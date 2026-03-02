
Feature: user registration and login
  Scenario: wechat user login
    Given wechat mini app
    When wechat user_1 first open
    Then register as a new user
    When wechat user_1 open again
    Then login successfully and get user profile