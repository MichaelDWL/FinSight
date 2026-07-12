const { Router } = require("express");

const appRoutes = require("../modules/app/app.routes");
const accountsRoutes = require("../modules/accounts/accounts.routes");
const cardsRoutes = require("../modules/cards/cards.routes");
const dashboardRoutes = require("../modules/dashboard/dashboard.routes");
const goalsRoutes = require("../modules/goals/goals.routes");
const invoicesRoutes = require("../modules/invoices/invoices.routes");
const investmentsRoutes = require("../modules/investments/investments.routes");
const movementsRoutes = require("../modules/movements/movements.routes");
const recurrencesRoutes = require("../modules/recurrences/recurrences.routes");
const reportsRoutes = require("../modules/reports/reports.routes");
const usersRoutes = require("../modules/users/users.routes");

const router = Router();

router.use("/app", appRoutes);
router.use("/accounts", accountsRoutes);
router.use("/cards", cardsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/goals", goalsRoutes);
router.use("/invoices", invoicesRoutes);
router.use("/investments", investmentsRoutes);
router.use("/movements", movementsRoutes);
router.use("/recurrences", recurrencesRoutes);
router.use("/reports", reportsRoutes);
router.use("/users", usersRoutes);

module.exports = router;
