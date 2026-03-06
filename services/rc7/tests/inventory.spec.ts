import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';

const feature = await loadFeature('tests/features/inventory.feature');

describeFeature(feature, ({ Background, Scenario }) => {
    Background(({ Given }) => {
        Given('a user with role admin is logged in', () => {});
        Given('created exhibition with 2 sessions and 2 ticket categories', () => {});
    });

    Scenario('view inventory of a session', ({ Given, When, Then }) => {
        Given('a session with inventory', () => {});
        When('view inventory of the session', () => {});
        Then('the inventory of all ticket categories in the session are empty by default', () => {});
    });

    Scenario('可以一次更新 exhibition 下某个 ticket category 所有 session 的 inventory', ({ Given, When, Then, And }) => {
        Given('inventory quantity 50 for ticket category {string} in all sessions of the exhibition', () => {});
        When('update inventory of ticket category {string} in all sessions of the exhibition', () => {});
        Then('inventory updated successfully', () => {});
        And('the inventory of ticket category {string} in all sessions of the exhibition is {int}', () => {});
        And('the inventory of another ticket category {string} in all sessions of the exhibition is still {int}', () => {});
    });

    Scenario('可以查看 一个 session 下所有 ticket category 的 inventory', ({ Given, When, Then, And }) => {
        Given('inventory quantity {int} for ticket category {string} in the first session of the exhibition', () => {});
        Given('inventory quantity 20 for ticket category {string} in the first session of the exhibition', () => {});
        When('view inventory of the first session of the exhibition', () => {});
        Then('the inventory of ticket category {string} in the first session of the exhibition is {int}', () => {});
        And('the inventory of ticket category {string} in the first session of the exhibition is 20', () => {});
    });
});