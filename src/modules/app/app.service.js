const accountsService = require("../accounts/accounts.service");
const cardsService = require("../cards/cards.service");

async function getBootstrap(userId) {
  const [accounts, cards] = await Promise.all([
    accountsService.list(userId),
    cardsService.list(userId),
  ]);

  return { accounts, cards };
}

module.exports = { getBootstrap };
