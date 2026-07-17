const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const apiRoutes = require("./routes");
const healthRoutes = require("./routes/healthRoutes");
const cronRoutes = require("./modules/cron/cron.routes");
const { errorMiddleware, notFoundMiddleware } = require("./middlewares/errorMiddleware");
const securityMiddleware = require("./middlewares/securityMiddleware");
const requestLogger = require("./middlewares/requestLogger");
const { bootstrapMiddleware } = require("./platform/bootstrap");
const { success } = require("./utils/apiResponse");

const app = express();

securityMiddleware(app);
app.use(morgan("combined"));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(requestLogger);
app.use(bootstrapMiddleware());

app.get("/", (_req, res) => {
  return success(res, {
    message: "FinSight API pronta para uso.",
    data: {
      health: "/health",
      api: "/api",
      auth: "/api/auth",
      admin: "/api/admin",
      cron: {
        market: "/api/cron/market",
      },
      bff: {
        home: "/api/home",
        dashboard: "/api/dashboard",
        investments: "/api/investments",
        accounts: "/api/accounts",
        cards: "/api/cards",
        accountDetail: "/api/account-detail/:id",
        cardDetail: "/api/card-detail/:id",
        transactions: "/api/transactions",
        reports: "/api/reports",
        insights: "/api/insights",
      },
    },
  });
});

app.use("/health", healthRoutes);
// Cron fora do authenticate/CSRF — protegido por CRON_SECRET
app.use("/api/cron", cronRoutes);
app.use("/api", apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
