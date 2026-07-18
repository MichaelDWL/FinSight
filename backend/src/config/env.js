const path = require("path");
const dotenv = require("dotenv");

// Ordem: backend/.env (dev legado) → raiz/.env → cwd
dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config();

function requiredInProduction(name, value) {
  if (process.env.NODE_ENV === "production" && !value) {
    throw new Error(`Variavel de ambiente obrigatoria em producao: ${name}`);
  }
  return value;
}

function assertStrongSecret(name, value, { minLength = 32 } = {}) {
  if (!isProduction) return value;
  if (!value || value.length < minLength) {
    throw new Error(`${name} deve ter pelo menos ${minLength} caracteres em producao.`);
  }
  const weak = [
    "change-me",
    "dev-",
    "altere-este",
    "substitua",
    "secret",
    "password",
    "finsight-change",
  ];
  const lower = String(value).toLowerCase();
  if (weak.some((token) => lower.includes(token))) {
    throw new Error(`${name} parece inseguro. Use um segredo gerado aleatoriamente em producao.`);
  }
  return value;
}

function assertStrongAdminPassword(password) {
  if (!isProduction || !password) return password;
  if (password.length < 12) {
    throw new Error("ADMIN_SEED_PASSWORD deve ter pelo menos 12 caracteres em producao.");
  }
  const weak = ["troque", "admin", "123456", "password", "senha", "substitua"];
  const lower = password.toLowerCase();
  if (weak.some((token) => lower.includes(token))) {
    throw new Error("ADMIN_SEED_PASSWORD fraca demais para producao.");
  }
  return password;
}

function parseSameSite(value) {
  const normalized = String(value || "lax").toLowerCase();
  if (["strict", "lax", "none"].includes(normalized)) return normalized;
  return "lax";
}

function parseDurationToMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  if (/^\d+$/.test(value)) return Number(value);
  const match = String(value).match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const map = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * map[unit];
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

const jwtAccessSecret = assertStrongSecret(
  "JWT_ACCESS_SECRET",
  requiredInProduction(
    "JWT_ACCESS_SECRET",
    process.env.JWT_ACCESS_SECRET || (!isProduction ? "dev-access-secret-change-me" : null)
  )
);
const jwtRefreshSecret = assertStrongSecret(
  "JWT_REFRESH_SECRET",
  requiredInProduction(
    "JWT_REFRESH_SECRET",
    process.env.JWT_REFRESH_SECRET || (!isProduction ? "dev-refresh-secret-change-me" : null)
  )
);

const adminSeedPassword = assertStrongAdminPassword(process.env.ADMIN_SEED_PASSWORD || null);

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true",
  /** CA PEM para validar certificado do Postgres (Neon/Supabase). Se ausente com SSL, usa rejectUnauthorized:true com CAs do sistema. */
  databaseSslCa: process.env.DATABASE_SSL_CA || null,
  /** Em producao com SSL, nunca desabilitar verificacao salvo DATABASE_SSL_INSECURE=true (emergencia). */
  databaseSslInsecure: process.env.DATABASE_SSL_INSECURE === "true",
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
  /** Limite por instancia em serverless (Neon/Supabase free). */
  dbPoolMaxServerless: Number(process.env.DB_POOL_MAX_SERVERLESS) || 2,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 300,
  redisUrl: process.env.REDIS_URL || null,
  redisEnabled: Boolean(process.env.REDIS_URL),
  /**
   * Em long-running: node-cron in-process.
   * Em serverless: desligado; use CRON_SECRET + /api/cron/market (Vercel Cron / crontab).
   */
  marketSchedulerEnabled: process.env.MARKET_SCHEDULER_ENABLED !== "false",
  cronSecret: assertStrongSecret(
    "CRON_SECRET",
    requiredInProduction(
      "CRON_SECRET",
      process.env.CRON_SECRET || (!isProduction ? "dev-cron-secret-change-me" : null)
    ),
    { minLength: 16 }
  ),
  brapiToken: process.env.BRAPI_TOKEN || null,

  uploadProvider: process.env.UPLOAD_PROVIDER || "stub",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || null,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || null,

  jwtAccessSecret,
  jwtRefreshSecret,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  accessTokenTtlMs: parseDurationToMs(process.env.JWT_ACCESS_EXPIRES_IN || "15m", 15 * 60 * 1000),
  refreshTokenTtlMs: parseDurationToMs(process.env.JWT_REFRESH_EXPIRES_IN || "7d", 7 * 24 * 60 * 60 * 1000),

  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : isProduction,
  cookieSameSite: parseSameSite(process.env.COOKIE_SAME_SITE),
  cookieDomain: process.env.COOKIE_DOMAIN || null,
  csrfEnabled: process.env.CSRF_ENABLED !== "false",

  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
  loginLockMinutes: Number(process.env.LOGIN_LOCK_MINUTES) || 15,

  passwordResetExpiresMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES) || 30,
  emailVerifyExpiresHours: Number(process.env.EMAIL_VERIFY_EXPIRES_HOURS) || 24,

  adminSeedName: process.env.ADMIN_SEED_NAME || "Administrador",
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL || null,
  adminSeedPassword,
  allowAdminSeed: process.env.ALLOW_ADMIN_SEED === "true",

  /** Retencao de historico de mercado (dias). 0 = sem purge automatico. */
  marketDataRetentionDays: Number(process.env.MARKET_DATA_RETENTION_DAYS) || 365,

  requireEmailVerified: process.env.REQUIRE_EMAIL_VERIFIED !== "false",
  privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION || "1.0",
  sentryDsn: process.env.SENTRY_DSN || null,

  emailProvider: process.env.EMAIL_PROVIDER || "console",
  emailFrom: process.env.EMAIL_FROM || "FinSight <noreply@finsight.local>",
  resendApiKey: process.env.RESEND_API_KEY || null,
  smtpHost: process.env.SMTP_HOST || null,
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER || null,
  smtpPass: process.env.SMTP_PASS || null,
  appPublicUrl: process.env.APP_PUBLIC_URL || "http://localhost:5500",

  rateLimitLoginMax: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
  rateLimitRegisterMax: Number(process.env.RATE_LIMIT_REGISTER_MAX) || 5,
  rateLimitPasswordResetMax: Number(process.env.RATE_LIMIT_PASSWORD_RESET_MAX) || 5,
  rateLimitRefreshMax: Number(process.env.RATE_LIMIT_REFRESH_MAX) || 30,
  rateLimitAdminMax: Number(process.env.RATE_LIMIT_ADMIN_MAX) || 120,
};

module.exports = env;
