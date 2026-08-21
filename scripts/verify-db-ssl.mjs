/**
 * Verifica conexao PostgreSQL com TLS validado (sem DATABASE_SSL_INSECURE).
 *
 * Uso:
 *   node --env-file=backend/.env.supabase scripts/verify-db-ssl.mjs
 *   node --env-file=backend/.env.supabase scripts/verify-db-ssl.mjs --ca-file=./certs/supabase-ca.crt
 *
 * Nao imprime DATABASE_URL nem PEM. Codigo de saida 0 = OK.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const { buildSslConfig, describeSslMode } = require("../backend/src/database/sslConfig");

const args = process.argv.slice(2);
const caFileArg = args.find((a) => a.startsWith("--ca-file="));
const caFile = caFileArg ? caFileArg.slice("--ca-file=".length) : process.env.DATABASE_SSL_CA_FILE;

if (!process.env.DATABASE_URL) {
  console.error("Falha: DATABASE_URL ausente.");
  process.exit(2);
}

const env = {
  isProduction: process.env.NODE_ENV === "production",
  databaseSsl: true,
  databaseSslInsecure: false,
  databaseSslCa: process.env.DATABASE_SSL_CA || null,
  databaseSslCaFile: caFile || null,
};

let ssl;
try {
  ssl = buildSslConfig(env);
} catch (error) {
  console.error("Falha ao montar SSL:", error.message);
  process.exit(2);
}

const mode = describeSslMode(ssl);
console.log(
  JSON.stringify(
    {
      step: "ssl-config",
      ...mode,
      hostHint: (() => {
        try {
          return new URL(process.env.DATABASE_URL).hostname;
        } catch {
          return "(url-invalida)";
        }
      })(),
    },
    null,
    2,
  ),
);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl,
  connectionTimeoutMillis: 15_000,
});

try {
  await client.connect();
  const { rows } = await client.query(
    "SELECT current_database() AS database, NOW() AS now, version() AS version",
  );
  console.log(
    JSON.stringify(
      {
        step: "connect",
        ok: true,
        database: rows[0]?.database,
        now: rows[0]?.now,
        postgresMajor: String(rows[0]?.version || "").split(" ")[1] || null,
        sslMode: mode,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (error) {
  console.error(
    JSON.stringify(
      {
        step: "connect",
        ok: false,
        code: error.code || null,
        message: error.message,
        hint:
          "Baixe o CA em Supabase → Project Settings → Database → SSL Configuration. " +
          "Defina DATABASE_SSL_CA (PEM) ou DATABASE_SSL_CA_FILE e rode novamente. " +
          "Nao use DATABASE_SSL_INSECURE=true em producao.",
      },
      null,
      2,
    ),
  );
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
