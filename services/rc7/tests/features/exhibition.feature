Feature: setup exhibition and tickets

  Background:
    Given a user with role admin is logged in

  Scenario: create a new exhibition
    Given exhibition name cr7_life_museum
    And description "welcome to cr7 life museum"
    And start date "2026-01-01"
    And end date "2026-02-28"
    And opening time "10:00"
    And closing time "18:00"
    And last entry time "15:30"
    And location "ShangHai"
    When create exhibition
    Then exhibition created successfully with empty ticket categories

  Scenario: add non-refundable ticket category to exhibition
    Given created exhibition
    Given draft ticket category "early_bird" to exhibition
    And price 100
    And valid duration 1 day
    And refund policy non refundable
    And admittance 1 person
    When add ticket category to exhibition
    Then ticket "early_bird" added successfully
    And exhibition has 1 ticket category "early_bird"

  Scenario: add a refundable ticket category
    Given created exhibition
    Given draft ticket category "regular" to exhibition
    And price 150
    And valid duration 10 day
    And refund policy refundable until 48 hours before the event
    And admittance 2 person
    When add ticket category to exhibition
    Then ticket "regular" added successfully
    And exhibition has 1 ticket categories "regular"

# todo
# - 更新 exhibition 基本信息
# - 更新 ticket category
