Feature: manage inventory

  Background:
    Given a user with role admin is logged in

  Scenario: view inventory of a session
    Given created exhibition with 2 sessions
      And created 2 ticket categories for the exhibition
    Given a session with inventory
     When view inventory of the session
     Then the inventory of all ticket categories in the session are empty by default

  Scenario: 可以一次更新 exhibition 下某个 ticket category 所有 session 的 inventory
    Given created exhibition with 2 sessions
      And created 2 ticket categories for the exhibition
    Given inventory quantity 50 for ticket category "early_bird" in all sessions of the exhibition
     When update inventory of ticket category "early_bird" in all sessions of the exhibition
     Then the inventory of ticket category "early_bird" in all sessions of the exhibition is 50
      And the inventory of another ticket category "regular" in all sessions of the exhibition is still 0

  Scenario: 可以查看 一个 session 下所有 ticket category 的 inventory
    Given created exhibition with 2 sessions
      And created 2 ticket categories for the exhibition
    Given inventory quantity 30 for ticket category "early_bird" in the first session of the exhibition
    Given inventory quantity 20 for ticket category "regular" in the first session of the exhibition
     When view inventory of the first session of the exhibition
     Then the inventory of ticket category "early_bird" in the first session of the exhibition is 30
      And the inventory of ticket category "regular" in the first session of the exhibition is 20

  Scenario: non-admin user cannot view inventory of a session
    Given created exhibition with 2 sessions by admin
      And created 2 ticket categories for the exhibition by admin
    Given a regular user is logged in
    When try to view inventory of a session
    Then permission denied error is returned

  Scenario: non-admin user cannot update inventory
    Given created exhibition with 2 sessions by admin
      And created 2 ticket categories for the exhibition by admin
    Given a regular user is logged in
    When try to update inventory of ticket category
    Then permission denied error is returned

