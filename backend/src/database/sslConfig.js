/**
 * Configuracao TLS do PostgreSQL — pura, testavel, sem side-effects de Pool.
 *
 * Variaveis:
 *   DATABASE_SSL=true|false
 *   DATABASE_SSL_CA=<PEM com \\n literais ou multilinha>
 *   DATABASE_SSL_CA_FILE=<caminho absoluto/relativo ao PEM>
 *   DATABASE_SSL_INSECURE=true  (emergencia; rejeitar em producao assim que CA validar)
 *
 * Fallback: backend/certs/supabase-root-2021-ca.crt (CA publica Supabase Root 2021).
 */

const fs = require("fs");
const path = require("path");

/** CA publica empacotada no repositorio (nao e segredo). */
const BUNDLED_SUPABASE_CA = path.join(__dirname, "..", "..", "certs", "supabase-root-2021-ca.crt");

/**
 * Normaliza PEM colado em env (Vercel/CI costumam usar \\n literais).
 * Aceita um ou mais certificados concatenados.
 */
function normalizePem(raw) {
  if (raw == null) return null;
  let value = String(raw).trim();
  if (!value) return null;

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  value = value.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  if (!value.includes("BEGIN CERTIFICATE")) {
    throw new Error(
      "DATABASE_SSL_CA invalido: esperado PEM com -----BEGIN CERTIFICATE-----.",
    );
  }

  return value;
}

function resolveCaFilePath(filePath, { existsSync = fs.existsSync } = {}) {
  if (!filePath) return null;
  const trimmed = String(filePath).trim();
  if (!trimmed) return null;
  if (path.isAbsolute(trimmed)) return trimmed;

  const backendRoot = path.resolve(__dirname, "..", "..");
  const repoRoot = path.resolve(backendRoot, "..");
  const normalized = trimmed.replace(/\\/g, "/");

  const candidates = [
    path.resolve(process.cwd(), trimmed),
    path.resolve(backendRoot, trimmed),
    path.resolve(repoRoot, trimmed),
  ];

  // DATABASE_SSL_CA_FILE=backend/certs/... com cwd=backend → evita backend/backend/...
  if (normalized.startsWith("backend/")) {
    candidates.push(path.resolve(repoRoot, normalized));
    candidates.push(path.resolve(backendRoot, normalized.slice("backend/".length)));
  }

  // Apenas o nome do arquivo dentro de backend/certs/
  candidates.push(path.resolve(backendRoot, "certs", path.basename(trimmed)));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

/**
 * @returns {{ pem: string|null, source: 'env'|'file'|'bundled'|null }}
 */
function loadCaPem(
  { databaseSslCa, databaseSslCaFile },
  { readFileSync = fs.readFileSync, existsSync = fs.existsSync } = {},
) {
  if (databaseSslCaFile) {
    const resolved = resolveCaFilePath(databaseSslCaFile, { existsSync });
    const contents = readFileSync(resolved, "utf8");
    return { pem: normalizePem(contents), source: "file" };
  }
  if (databaseSslCa) {
    return { pem: normalizePem(databaseSslCa), source: "env" };
  }
  if (existsSync(BUNDLED_SUPABASE_CA)) {
    const contents = readFileSync(BUNDLED_SUPABASE_CA, "utf8");
    return { pem: normalizePem(contents), source: "bundled" };
  }
  return { pem: null, source: null };
}

/**
 * @param {object} env — subset de config/env.js
 * @param {{ warn?: Function, readFileSync?: Function, existsSync?: Function }} [deps]
 * @returns {false | import('tls').ConnectionOptions}
 */
function buildSslConfig(env, deps = {}) {
  const warn = deps.warn || (() => undefined);

  if (!env.databaseSsl) {
    if (env.isProduction) {
      warn(
        "[database] DATABASE_SSL=false em producao. Supabase exige SSL — habilite DATABASE_SSL=true.",
      );
    }
    return false;
  }

  if (env.databaseSslInsecure) {
    if (env.isProduction) {
      warn(
        "[database] DATABASE_SSL_INSECURE=true em producao — verificacao de certificado DESABILITADA (risco de MITM). Remova DATABASE_SSL_INSECURE e use a CA empacotada (backend/certs/supabase-root-2021-ca.crt).",
      );
    }
    return { rejectUnauthorized: false };
  }

  const ssl = { rejectUnauthorized: true };
  const { pem, source } = loadCaPem(env, deps);
  if (pem) {
    ssl.ca = pem;
  } else if (env.isProduction) {
    warn(
      "[database] SSL ativo sem CA: rejectUnauthorized=true pode falhar no Supabase. Empacote backend/certs/supabase-root-2021-ca.crt ou defina DATABASE_SSL_CA.",
    );
  }
  ssl.__caSource = source;
  return ssl;
}

/**
 * Descreve o modo SSL efetivo (para /ready e logs — sem vazar PEM).
 */
function describeSslMode(ssl) {
  if (!ssl) {
    return {
      enabled: false,
      rejectUnauthorized: null,
      caProvided: false,
      caSource: null,
    };
  }
  return {
    enabled: true,
    rejectUnauthorized: ssl.rejectUnauthorized !== false,
    caProvided: Boolean(ssl.ca),
    caSource: ssl.__caSource || (ssl.ca ? "unknown" : null),
  };
}

module.exports = {
  normalizePem,
  loadCaPem,
  buildSslConfig,
  describeSslMode,
  resolveCaFilePath,
  BUNDLED_SUPABASE_CA,
};
