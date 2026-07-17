/**
 * Configuracao central de Rate Limit.
 * Altere SOMENTE este arquivo para ajustar limites.
 * Valores em windowMs / max; nenhum magic number nas rotas.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const rateLimitConfig = Object.freeze({
  /** Sem REDIS_URL em producao: alerta; memoria so e aceitavel em desenvolvimento. */
  requireRedisInProduction: true,

  /** Prefixo Redis / store */
  keyPrefix: "finsight:rl",

  /** Limite global da API (por IP) */
  global: Object.freeze({
    windowMs: 15 * MINUTE,
    max: 300,
    message: "Limite global de requisicoes atingido. Aguarde e tente novamente.",
  }),

  /** Grupos / endpoints */
  groups: Object.freeze({
    login: Object.freeze({
      windowMs: MINUTE,
      max: 5,
      message: "Muitas tentativas de login. Aguarde 1 minuto.",
      keyBy: "ip",
    }),
    register: Object.freeze({
      windowMs: MINUTE,
      max: 3,
      message: "Muitos registros. Aguarde 1 minuto.",
      keyBy: "ip",
    }),
    passwordReset: Object.freeze({
      windowMs: 15 * MINUTE,
      max: 3,
      message: "Muitas solicitacoes de recuperacao de senha. Aguarde 15 minutos.",
      keyBy: "ip",
    }),
    refresh: Object.freeze({
      windowMs: MINUTE,
      max: 20,
      message: "Limite de refresh token atingido.",
      keyBy: "ip",
    }),
    dashboard: Object.freeze({
      windowMs: MINUTE,
      max: 100,
      message: "Limite de consultas ao dashboard atingido.",
      keyBy: "user",
    }),
    movements: Object.freeze({
      windowMs: MINUTE,
      max: 60,
      message: "Limite de movimentacoes atingido.",
      keyBy: "user",
    }),
    investments: Object.freeze({
      windowMs: MINUTE,
      max: 60,
      message: "Limite de investimentos atingido.",
      keyBy: "user",
    }),
    market: Object.freeze({
      windowMs: MINUTE,
      max: 30,
      message: "Limite de consultas de mercado atingido.",
      keyBy: "user",
    }),
    reports: Object.freeze({
      windowMs: MINUTE,
      max: 20,
      message: "Limite de relatorios atingido.",
      keyBy: "user",
    }),
    admin: Object.freeze({
      windowMs: MINUTE,
      max: 30,
      message: "Limite de requisicoes administrativas atingido.",
      keyBy: "user",
    }),
    privacyExport: Object.freeze({
      windowMs: HOUR,
      max: 2,
      message: "Limite de exportacao LGPD atingido (2/hora).",
      keyBy: "user",
    }),
    bff: Object.freeze({
      windowMs: MINUTE,
      max: 120,
      message: "Limite de consultas BFF atingido.",
      keyBy: "user",
    }),
    accounts: Object.freeze({
      windowMs: MINUTE,
      max: 60,
      message: "Limite de contas atingido.",
      keyBy: "user",
    }),
    cards: Object.freeze({
      windowMs: MINUTE,
      max: 60,
      message: "Limite de cartoes atingido.",
      keyBy: "user",
    }),
  }),

  /** Slow-down complementar no login (anti brute-force) */
  loginSlowDown: Object.freeze({
    windowMs: MINUTE,
    delayAfter: 2,
    delayMs: 750,
  }),
});

module.exports = rateLimitConfig;
