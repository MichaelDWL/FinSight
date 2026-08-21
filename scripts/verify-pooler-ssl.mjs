/**
 * Testa TLS validado contra a URL do pooler (.env.vercel) sem imprimir secrets.
 * Uso: node scripts/verify-pooler-ssl.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { Client } from "pg";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

dotenv.config({ path: "backend/.env.vercel" });

const { buildSslConfig, describeSslMode } = require("../backend/src/database/sslConfig");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ausente em backend/.env.vercel");
  process.exit(2);
}

const caFile = process.argv.find((a) => a.startsWith("--ca-file="))?.slice(10)
  || "./certs/supabase-root-2021-ca.crt";

const env = {
  isProduction: true,
  databaseSsl: true,
  databaseSslInsecure: false,
  databaseSslCa: null,
  databaseSslCaFile: caFile,
};

const ssl = buildSslConfig(env);
const mode = describeSslMode(ssl);
let hostHint = "(?)";
try {
  hostHint = new URL(process.env.DATABASE_URL).hostname;
} catch {
  /* ignore */
}

console.log(JSON.stringify({ step: "ssl-config", ...mode, hostHint, caFile }, null, 2));

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl,
  connectionTimeoutMillis: 20_000,
});

try {
  await client.connect();
  const { rows } = await client.query(
    "SELECT current_database() AS database, NOW() AS now",
  );
  console.log(
    JSON.stringify(
      {
        step: "connect",
        ok: true,
        database: rows[0]?.database,
        now: rows[0]?.now,
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
      },
      null,
      2,
    ),
  );
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}

void fs;
