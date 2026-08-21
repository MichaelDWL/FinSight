import { spawnSync } from "node:child_process";
import fs from "node:fs";

const r = spawnSync(
  process.execPath,
  ["--env-file=backend/.env.vercel", "scripts/measure-cold-warm.mjs", "--rounds", "3"],
  { encoding: "utf8", cwd: process.cwd() },
);

const out = `${r.stdout || ""}\n${r.stderr || ""}`;
const marker = '"methodology"';
const m = out.indexOf(marker);
if (m < 0) {
  console.error("methodology not found");
  console.error(out.slice(0, 800));
  process.exit(1);
}
const brace = out.lastIndexOf("{", m);
const j = JSON.parse(out.slice(brace));

const rows = j.phases.burst.results.map((x) => {
  const miss = x.samples.find((s) => s.cache === "MISS") || x.samples[0];
  const hit = x.samples.find((s) => s.cache === "HIT");
  return {
    name: x.name,
    missWall: miss.wallMs,
    missServer: miss.serverMs,
    missSql: miss.sqlCount,
    hitServer: hit?.serverMs ?? null,
    hitWall: hit?.wallMs ?? null,
    wallP50: x.summary.wallP50,
    wallP95: x.summary.wallP95,
  };
});

const summary = {
  measuredAt: j.meta?.measuredAt,
  ready: j.phases.readyBefore.samples.map((s) => ({
    wall: s.wallMs,
    db: s.dbMs,
  })),
  rows,
};

fs.writeFileSync("docs/ops/fase5-etapa10-summary.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
