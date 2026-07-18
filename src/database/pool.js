/**
 * Camada UNICA de conexao com o PostgreSQL.
 *
 * Toda a aplicacao (repositorios, services, health check) deve importar este
 * modulo. Nunca instanciar `new Pool` / `new Client` em outro lugar.
 *
 * Comportamento controlado 100% por variaveis de ambiente (.env), sem qualquer
 * diferenca de codigo entre ambientes:
 *   - Desenvolvimento (Docker Postgres local): DATABASE_SSL=false, pool grande.
 *   - Producao (Supabase / Vercel Serverless): DATABASE_SSL=true, pool pequeno.
 */

const { Pool } = require("pg");

const env = require("../config/env");
const { isServerless } = require("../platform/runtime");
const logger = require("../utils/logger");
const { recordQuery } = require("../modules/bff/monitoring/sql.tracker");

// Singleton entre "warm" invocations do serverless e entre hot-reloads em dev.
// Guardar no globalThis evita que um require duplicado (ex.: caminhos resolvidos
// de formas diferentes, ou modulo recarregado) crie pools paralelos que
// esgotariam as conexoes do Postgres (critico no Supabase free tier).
const GLOBAL_KEY = Symbol.for("finsight.database.pool");

if (!env.databaseUrl) {
  throw new Error(
    "DATABASE_URL nao configurada. Defina no .env (dev: Postgres local; prod: Supabase)."
  );
}

/**
 * Traduz erros de baixo nivel (driver pg / socket / TLS) em mensagens claras.
 * Retorna { title, hint } para log estruturado, sem vazar credenciais.
 */
function describeDbError(error) {
  const code = error && error.code;
  const message = String((error && error.message) || "");

  switch (code) {
    case "ECONNREFUSED":
      return {
        title: "Conexao recusada pelo servidor PostgreSQL.",
        hint: "O banco nao esta aceitando conexoes no host/porta informados. Verifique se o container/servico esta no ar e se DATABASE_URL (host e porta) esta correta.",
      };
    case "ETIMEDOUT":
    case "ESOCKETTIMEDOUT":
      return {
        title: "Timeout ao conectar ao PostgreSQL.",
        hint: "Sem resposta dentro de connectionTimeoutMillis. Verifique rede/firewall, e se o host do banco (Supabase) esta acessivel a partir deste ambiente.",
      };
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return {
        title: "Host do banco de dados nao encontrado (DNS).",
        hint: "Nao foi possivel resolver o hostname em DATABASE_URL. Confira o endereco do projeto Supabase.",
      };
    case "28P01":
      return {
        title: "Falha de autenticacao no PostgreSQL.",
        hint: "Usuario ou senha invalidos em DATABASE_URL. No Supabase confira a senha do projeto e o usuario (ex.: postgres).",
      };
    case "28000":
      return {
        title: "Conexao nao autorizada pelo PostgreSQL.",
        hint: "Regra de autorizacao (pg_hba/role) rejeitou a conexao. Verifique o usuario e as permissoes.",
      };
    case "3D000":
      return {
        title: "Banco de dados inexistente.",
        hint: "O database informado em DATABASE_URL nao existe. Verifique o nome apos a ultima '/'.",
      };
    case "57P03":
      return {
        title: "PostgreSQL indisponivel no momento.",
        hint: "O servidor esta iniciando ou em recuperacao. Tente novamente em instantes.",
      };
    case "53300":
      return {
        title: "Limite de conexoes do PostgreSQL atingido.",
        hint: "Reduza DB_POOL_MAX / DB_POOL_MAX_SERVERLESS ou use o pooler do Supabase (porta 6543).",
      };
    default:
      break;
  }

  // Erros de TLS/SSL (nao possuem os codigos acima).
  if (
    /self.signed|self-signed|SELF_SIGNED|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT_|SSL|TLS/i.test(
      message
    ) ||
    /^(SELF_SIGNED|DEPTH_ZERO|UNABLE_TO_VERIFY|CERT_)/i.test(String(code || ""))
  ) {
    return {
      title: "Falha na verificacao de SSL/TLS do PostgreSQL.",
      hint: "O certificado nao pode ser validado. Em producao forneca DATABASE_SSL_CA (PEM do Supabase). Apenas para testes locais e permitido DATABASE_SSL_INSECURE=true.",
    };
  }

  if (/does not support SSL|server does not support SSL/i.test(message)) {
    return {
      title: "O servidor PostgreSQL nao suporta SSL.",
      hint: "Voce definiu DATABASE_SSL=true, mas o banco (ex.: Docker local) nao aceita SSL. Use DATABASE_SSL=false em desenvolvimento.",
    };
  }

  return {
    title: "Erro inesperado na conexao com o PostgreSQL.",
    hint: message || "Sem detalhes adicionais.",
  };
}

/**
 * Monta a config de SSL a partir do .env, sem segredos fixos no codigo.
 *  - DATABASE_SSL=false            -> SSL desabilitado (dev / Docker).
 *  - DATABASE_SSL=true             -> valida certificado (rejectUnauthorized:true).
 *  - DATABASE_SSL_CA=<PEM>         -> valida contra o CA informado (Supabase).
 *  - DATABASE_SSL_INSECURE=true    -> nao valida (SOMENTE testes; nunca producao).
 */
function buildSslConfig() {
  if (!env.databaseSsl) {
    if (env.isProduction) {
      logger.warn(
        "[database] DATABASE_SSL=false em producao. Supabase exige SSL — habilite DATABASE_SSL=true."
      );
    }
    return false;
  }

  if (env.databaseSslInsecure) {
    if (env.isProduction) {
      logger.warn(
        "[database] DATABASE_SSL_INSECURE=true em producao — verificacao de certificado DESABILITADA (risco de MITM). Remova assim que possivel."
      );
    }
    return { rejectUnauthorized: false };
  }

  const ssl = { rejectUnauthorized: true };
  if (env.databaseSslCa) {
    // Permite CA colado em uma linha com "\n" literais (formato comum em envs).
    ssl.ca = env.databaseSslCa.replace(/\\n/g, "\n");
  }
  return ssl;
}

/**
 * Cria e configura o Pool. Chamado UMA unica vez (protegido pelo singleton).
 */
function createPool() {
  // Serverless: poucas conexoes por instancia para nao esgotar o Postgres.
  // Long-running: DB_POOL_MAX (default 10).
  const poolMax = isServerless
    ? Math.max(1, Math.min(env.dbPoolMax, env.dbPoolMaxServerless || 2))
    : env.dbPoolMax;

  const pool = new Pool({
    connectionString: env.databaseUrl,
    application_name: "finsight",
    max: poolMax,
    // Serverless: libera conexoes ociosas rapidamente (instancias efemeras).
    idleTimeoutMillis: isServerless ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
    // Evita que a instancia serverless fique presa por conexoes ociosas.
    allowExitOnIdle: isServerless,
    // Mantem sockets vivos (recomendado para Supabase atras de proxy/pooler).
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: buildSslConfig(),
  });

  pool.on("error", (error) => {
    const { title, hint } = describeDbError(error);
    logger.error(`[database] ${title}`, { code: error && error.code, hint });
  });

  // Instrumentacao de metricas SQL por request (preserva sql.tracker).
  const originalQuery = pool.query.bind(pool);
  pool.query = async function trackedQuery(...args) {
    const started = process.hrtime.bigint();
    try {
      const result = await originalQuery(...args);
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const rowCount = Array.isArray(result?.rows)
        ? result.rows.length
        : Number(result?.rowCount) || 0;
      recordQuery({ durationMs, rowCount });
      return result;
    } catch (error) {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      recordQuery({ durationMs, rowCount: 0 });
      throw error;
    }
  };

  /**
   * Health check da conexao — usado pelo endpoint GET /ready.
   * Executa `SELECT NOW()` (+ versao e database atual) e reporta status,
   * tempo de resposta, versao do PostgreSQL e database em uso.
   */
  pool.checkDatabaseConnection = async function checkDatabaseConnection() {
    const started = process.hrtime.bigint();
    try {
      const { rows } = await originalQuery(
        "SELECT NOW() AS now, version() AS version, current_database() AS database"
      );
      const responseTimeMs = Number(process.hrtime.bigint() - started) / 1e6;
      const row = rows[0] || {};
      return {
        status: "ok",
        responseTimeMs: Math.round(responseTimeMs * 100) / 100,
        now: row.now || null,
        postgresVersion: row.version || null,
        database: row.database || null,
        ssl: Boolean(pool.options && pool.options.ssl),
        poolMax,
      };
    } catch (error) {
      const responseTimeMs = Number(process.hrtime.bigint() - started) / 1e6;
      const { title, hint } = describeDbError(error);
      logger.error(`[database] health check falhou: ${title}`, {
        code: error && error.code,
        hint,
      });
      return {
        status: "error",
        responseTimeMs: Math.round(responseTimeMs * 100) / 100,
        code: (error && error.code) || null,
        message: title,
        hint,
      };
    }
  };

  logger.info("[database] pool inicializado", {
    runtime: isServerless ? "serverless" : "long-running",
    poolMax,
    ssl: Boolean(pool.options && pool.options.ssl),
  });

  return pool;
}

/** @type {import('pg').Pool} */
const pool = globalThis[GLOBAL_KEY] || (globalThis[GLOBAL_KEY] = createPool());

module.exports = pool;
