/**
 * FASE 5 — Etapa 4: medir custo de require no bootstrap (LOCAL).
 *
 * Nao e benchmark de producao. Serve para ranquear imports no cold start.
 *
 * Uso:
 *   node scripts/measure-bootstrap.mjs
 *
 * Cada alvo roda em processo filho isolado (Module cache limpo).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  { id: "argon2", code: `require("argon2")` },
  { id: "pg", code: `require("pg")` },
  { id: "express", code: `require("express")` },
  { id: "zod", code: `require("zod")` },
  { id: "jsonwebtoken", code: `require("jsonwebtoken")` },
  { id: "ua-parser-js", code: `require("ua-parser-js")` },
  { id: "helmet+cors+compression", code: `require("helmet");require("cors");require("compression")` },
  { id: "utils/crypto (argon2)", code: `require("./backend/src/utils/crypto")` },
  { id: "csrf.middleware", code: `require("./backend/src/middlewares/csrf.middleware")` },
  { id: "requestMeta", code: `require("./backend/src/utils/requestMeta")` },
  { id: "database/pool", code: `require("./backend/src/database/pool")` },
  { id: "platform/bootstrap", code: `require("./backend/src/platform/bootstrap")` },
  { id: "bff/routes", code: `require("./backend/src/modules/bff/bff.routes")` },
  { id: "routes/index (all API)", code: `require("./backend/src/routes")` },
  { id: "app.js (full Express)", code: `require("./backend/src/app")` },
  {
    id: "personalization/index",
    code: `require("./backend/src/modules/personalization")`,
  },
  {
    id: "market.scheduler",
    code: `require("./backend/src/modules/market-data/market.scheduler")`,
  },
  {
    id: "investments.service",
    code: `require("./backend/src/modules/investments/investments.service")`,
  },
];

function measureOne(target) {
  const script = `
const t0 = process.hrtime.bigint();
${target.code};
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
process.stdout.write(JSON.stringify({ id: ${JSON.stringify(target.id)}, ms: Math.round(ms * 100) / 100 }));
`;
  const env = { ...process.env, RUNTIME: "serverless" };
  // Evita crash se DATABASE_URL ausente em alguns alvos — usa .env.vercel se existir.
  const vercelEnv = path.join(root, "backend", ".env.vercel");
  const localEnv = path.join(root, "backend", ".env");
  const envFile = fs.existsSync(vercelEnv)
    ? vercelEnv
    : fs.existsSync(localEnv)
      ? localEnv
      : null;

  const args = envFile
    ? [`--env-file=${envFile}`, "-e", script]
    : ["-e", script];

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 60_000,
  });

  if (result.status !== 0) {
    return {
      id: target.id,
      ms: null,
      error: (result.stderr || result.stdout || "fail").slice(0, 200),
    };
  }
  try {
    return JSON.parse(result.stdout.trim().split("\n").pop());
  } catch {
    return { id: target.id, ms: null, error: "parse", raw: result.stdout.slice(0, 120) };
  }
}

function main() {
  const rounds = 3;
  const rows = [];

  for (const target of TARGETS) {
    const samples = [];
    for (let i = 0; i < rounds; i += 1) {
      const r = measureOne(target);
      if (r.ms != null) samples.push(r.ms);
      else if (i === rounds - 1) {
        rows.push({ ...r, samples: [], p50: null });
      }
    }
    if (!samples.length) continue;
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)];
    rows.push({
      id: target.id,
      samples,
      p50,
      max: samples[samples.length - 1],
    });
  }

  rows.sort((a, b) => (b.p50 || 0) - (a.p50 || 0));

  console.log(
    JSON.stringify(
      {
        note: "LOCAL only — nao usar como benchmark de producao Vercel.",
        rounds,
        measuredAt: new Date().toISOString(),
        ranking: rows,
      },
      null,
      2,
    ),
  );
}

main();
