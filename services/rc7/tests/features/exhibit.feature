Feature: setup exhibition and tickets

  Background:
    Given a user with role admin is logged in

  Scenario: create a new exhibition
    Given exhibition name cr7_life_museum
    And description "welcome to cr7 life museum"
    And start date "2026-01-01"
    And end date "2026-02-31"
    And opening time "10:00"
    And closing time "18:00"
    And last entry time "15:30"
    And location "ShangHai"
    When create exhibition
    Then exhibition created successfully with empty ticket categories

  Scenario: add new ticket category to exhibition
    Given created exhibition
    When add ticket category "early_bird" to exhibition
    And price 100
    And valid duration 1 day
    And refound policy non refundable
    And admittance 1 person
    Then ticket category to exhibition "early_bird" added successfully

  Scenario: add another ticket category to exhibition
    Given created exhibition
    When add ticket category "regular" to exhibition
    And price 150
    And valid duration 10 day
    And refound policy refundable until 48 hours before the event
    And admittance 2 person
    Then ticket category to exhibition "regular" added successfully
