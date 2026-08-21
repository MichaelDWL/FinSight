const accountsService = require("../accounts/accounts.service");
const cardsService = require("../cards/cards.service");

/**
 * Bootstrap leve: contas sem CTE de movimentacoes + cartoes.
 * Stats mensais ficam no BFF /accounts quando a tela precisa.
 */
async function getBootstrap(userId) {
  const [accounts, cards] = await Promise.all([
    accountsService.listSummary(userId),
    cardsService.list(userId),
  ]);

  return { accounts, cards };
}

module.exports = { getBootstrap };
