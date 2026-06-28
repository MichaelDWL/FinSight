const app = require("./app");
const env = require("./config/env");

app.listen(env.port, () => {
  console.log(`FinSight API rodando na porta ${env.port}`);
});
