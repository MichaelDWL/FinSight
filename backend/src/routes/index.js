const { Router } = require("express");

const { authenticate } = require("../middlewares/authenticate.middleware");
const { csrfProtection } = require("../middlewares/csrf.middleware");

/**
 * Monta router sob demanda na 1a request do mountPath.
 * Evita carregar CRUD/market/admin no cold start de /api/home e /ready.
 */
function mountLazy(parent, mountPath, loader) {
  let cached = null;
  parent.use(mountPath, (req, res, next) => {
    if (!cached) {
      cached = loader();
    }
    return cached(req, res, next);
  });
}

const router = Router();

// Auth e BFF no caminho critico — eager.
const authRoutes = require("../modules/auth/auth.routes");
const bffRoutes = require("../modules/bff/bff.routes");

router.use("/auth", authRoutes);

// Admin nao e necessario para BFF/home — lazy.
mountLazy(router, "/admin", () => require("../modules/admin/admin.routes"));

router.use(authenticate);
router.use(csrfProtection);

router.use(bffRoutes);

mountLazy(router, "/app", () => require("../modules/app/app.routes"));
mountLazy(router, "/accounts", () => require("../modules/accounts/accounts.routes"));
mountLazy(router, "/cards", () => require("../modules/cards/cards.routes"));
mountLazy(router, "/dashboard", () => require("../modules/dashboard/dashboard.routes"));
mountLazy(router, "/goals", () => require("../modules/goals/goals.routes"));
mountLazy(router, "/invoices", () => require("../modules/invoices/invoices.routes"));
mountLazy(router, "/investments", () => require("../modules/investments/investments.routes"));
mountLazy(router, "/market", () => require("../modules/market-data/market.routes"));
mountLazy(router, "/movements", () => require("../modules/movements/movements.routes"));
mountLazy(router, "/personalization", () => require("../modules/personalization/personalization.routes"));
mountLazy(router, "/privacy", () => require("../modules/privacy/privacy.routes"));
mountLazy(router, "/recurrences", () => require("../modules/recurrences/recurrences.routes"));
mountLazy(router, "/users", () => require("../modules/users/users.routes"));

module.exports = router;
