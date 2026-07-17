/**
 * Export HTTP unico para adapters (Vercel, Lambda, etc.).
 * O app Express ja inclui bootstrap lazy — sem SDK de plataforma aqui.
 */
module.exports = require("../app");
