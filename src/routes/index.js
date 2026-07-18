const { Router } = require("express");

const appRoutes = require("../modules/app/app.routes");
const accountsRoutes = require("../modules/accounts/accounts.routes");
const cardsRoutes = require("../modules/cards/cards.routes");
const dashboardRoutes = require("../modules/dashboard/dashboard.routes");
const goalsRoutes = require("../modules/goals/goals.routes");
const invoicesRoutes = require("../modules/invoices/invoices.routes");
const investmentsRoutes = require("../modules/investments/investments.routes");
const marketRoutes = require("../modules/market-data/market.routes");
const movementsRoutes = require("../modules/movements/movements.routes");
const recurrencesRoutes = require("../modules/recurrences/recurrences.routes");
const usersRoutes = require("../modules/users/users.routes");
const personalizationRoutes = require("../modules/personalization/personalization.routes");
const privacyRoutes = require("../modules/privacy/privacy.routes");
const authRoutes = require("../modules/auth/auth.routes");
const adminRoutes = require("../modules/admin/admin.routes");
const bffRoutes = require("../modules/bff/bff.routes");
const { authenticate } = require("../middlewares/authenticate.middleware");
const { csrfProtection } = require("../middlewares/csrf.middleware");

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);

// Demais rotas da API exigem autenticacao + CSRF em mutacoes
router.use(authenticate);
router.use(csrfProtection);

// BFF — uma chamada HTTP por tela (registrado antes dos CRUDs)
router.use(bffRoutes);

router.use("/app", appRoutes);
router.use("/accounts", accountsRoutes);
router.use("/cards", cardsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/goals", goalsRoutes);
router.use("/invoices", invoicesRoutes);
router.use("/investments", investmentsRoutes);
router.use("/market", marketRoutes);
router.use("/movements", movementsRoutes);
router.use("/personalization", personalizationRoutes);
router.use("/privacy", privacyRoutes);
router.use("/recurrences", recurrencesRoutes);
router.use("/users", usersRoutes);

module.exports = router;
