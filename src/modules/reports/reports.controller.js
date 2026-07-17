const dashboardService = require("../dashboard/dashboard.service");
const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");

const list = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboard(getCurrentUserId(req));
  return success(res, {
    message: "Relatorio financeiro carregado.",
    data: {
      summary: {
        balance: data.balance,
        income: data.income,
        expenses: data.expenses,
        netWorth: data.netWorth,
        pendingBills: data.pendingBills,
      },
      transactions: data.transactions,
      investments: data.investments,
      goals: data.goals,
    },
  });
});

module.exports = { list };
