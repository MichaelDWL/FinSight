const { Router } = require("express");

const accountsRoutes = require("../modules/accounts/accounts.routes");
const billsRoutes = require("../modules/bills/bills.routes");
const cardsRoutes = require("../modules/cards/cards.routes");
const dashboardRoutes = require("../modules/dashboard/dashboard.routes");
const goalsRoutes = require("../modules/goals/goals.routes");
const investmentsRoutes = require("../modules/investments/investments.routes");
const reportsRoutes = require("../modules/reports/reports.routes");
const transactionsRoutes = require("../modules/transactions/transactions.routes");
const usersRoutes = require("../modules/users/users.routes");

const router = Router();

router.use("/accounts", accountsRoutes);
router.use("/bills", billsRoutes);
router.use("/cards", cardsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/goals", goalsRoutes);
router.use("/investments", investmentsRoutes);
router.use("/reports", reportsRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/users", usersRoutes);

module.exports = router;
