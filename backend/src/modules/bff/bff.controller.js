const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const { getCurrentUserId } = require("../../utils/demoUser");
const { runWithSqlTracking } = require("./monitoring/sql.tracker");
const { runWithRequestContext } = require("./utils/requestContext");
const { createBffMonitor, countRecords } = require("./monitoring/bff.monitor");

function runBffTracked(fn) {
  return runWithSqlTracking(() => runWithRequestContext(fn));
}

/**
 * Carrega o service BFF so na 1a invocacao daquele endpoint.
 * Evita puxar investments/reports/etc. no cold start de /api/home.
 */
function lazyFn(loader) {
  let fn = null;
  return (...args) => {
    if (!fn) fn = loader();
    return fn(...args);
  };
}

function createHandler(endpoint, serviceFn, message) {
  return asyncHandler(async (req, res) => {
    const userId = getCurrentUserId(req);
    const monitor = createBffMonitor(endpoint, { userId });

    const { data, cacheHit } = await runBffTracked(async () => {
      const result = await serviceFn(userId, req.query || {}, { reqUser: req.user });
      monitor.captureSql();
      return result;
    });

    monitor.setCacheHit(cacheHit);
    monitor.setRecordCount(countRecords(data));

    const payload = monitor.measureSerialize(() => data);
    monitor.finish(res, payload);

    return success(res, {
      message,
      data: payload,
    });
  });
}

function createDetailHandler(endpoint, serviceFn, message) {
  return asyncHandler(async (req, res) => {
    const userId = getCurrentUserId(req);
    const id = req.params.id;
    const monitor = createBffMonitor(endpoint, { userId });

    const { data, cacheHit } = await runBffTracked(async () => {
      const result = await serviceFn(userId, id, { reqUser: req.user });
      monitor.captureSql();
      return result;
    });

    monitor.setCacheHit(cacheHit);
    monitor.setRecordCount(countRecords(data));

    const payload = monitor.measureSerialize(() => data);
    monitor.finish(res, payload);

    return success(res, {
      message,
      data: payload,
    });
  });
}

const home = createHandler(
  "home",
  lazyFn(() => require("./services/home.bff.service").getHome),
  "Home carregada.",
);
const homeSecondary = createHandler(
  "home-secondary",
  lazyFn(() => require("./services/home.bff.service").getHomeSecondary),
  "Home secundaria carregada.",
);
const dashboard = createHandler(
  "dashboard",
  lazyFn(() => require("./services/dashboard.bff.service").getDashboard),
  "Dashboard carregado.",
);
const investments = createHandler(
  "investments",
  lazyFn(() => require("./services/investments.bff.service").getInvestments),
  "Investimentos carregados.",
);
const accounts = createHandler(
  "accounts",
  lazyFn(() => require("./services/accounts.bff.service").getAccounts),
  "Contas carregadas.",
);
const cards = createHandler(
  "cards",
  lazyFn(() => require("./services/cards.bff.service").getCards),
  "Cartoes carregados.",
);
const transactions = createHandler(
  "transactions",
  lazyFn(() => require("./services/transactions.bff.service").getTransactions),
  "Transacoes carregadas.",
);
const reports = createHandler(
  "reports",
  lazyFn(() => require("./services/reports.bff.service").getReports),
  "Relatorios carregados.",
);
const insights = createHandler(
  "insights",
  lazyFn(() => require("./services/insights.bff.service").getInsights),
  "Insights carregados.",
);
const accountDetail = createDetailHandler(
  "account-detail",
  lazyFn(() => require("./services/account-detail.bff.service").getAccountDetail),
  "Detalhe da conta carregado.",
);
const cardDetail = createDetailHandler(
  "card-detail",
  lazyFn(() => require("./services/card-detail.bff.service").getCardDetail),
  "Detalhe do cartao carregado.",
);

module.exports = {
  home,
  homeSecondary,
  dashboard,
  investments,
  accounts,
  cards,
  transactions,
  reports,
  insights,
  accountDetail,
  cardDetail,
};
