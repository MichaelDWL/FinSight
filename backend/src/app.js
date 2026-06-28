const cors = require("cors");
const express = require("express");

const env = require("./config/env");
const healthRoutes = require("./routes/healthRoutes");

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "FinSight API",
    health: "/health",
  });
});

app.use("/health", healthRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Rota nao encontrada",
    path: req.originalUrl,
  });
});

module.exports = app;
