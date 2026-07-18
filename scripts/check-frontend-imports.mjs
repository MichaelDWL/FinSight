#!/usr/bin/env node
/**
 * Verificador estatico de imports/exports do frontend (ESM vanilla, sem bundler).
 * Garante que todo `import { x } from "./y.js"` aponte para um arquivo existente
 * que realmente exporte `x`. Segue `export * from` um nivel.
 *
 * Uso: node scripts/check-frontend-imports.mjs
 * Sai com codigo != 0 se encontrar qualquer inconsistencia.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "frontend", "js");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Extrai os nomes exportados de um arquivo. Retorna {named:Set, hasDefault, star:[paths]} */
function parseExports(src, filePath) {
  const named = new Set();
  const star = [];
  let hasDefault = false;
  const code = stripComments(src);

  // export function/const/let/var/class NAME
  const declRe = /export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = declRe.exec(code))) named.add(m[1]);

  // export default
  if (/export\s+default\b/.test(code)) hasDefault = true;

  // export { a, b as c } (optionally from "...")
  const braceRe = /export\s*\{([^}]*)\}\s*(?:from\s*["']([^"']+)["'])?/g;
  while ((m = braceRe.exec(code))) {
    const body = m[1];
    for (const part of body.split(",")) {
      const seg = part.trim();
      if (!seg) continue;
      const asMatch = seg.match(/\bas\s+([A-Za-z0-9_$]+)$/);
      const name = asMatch ? asMatch[1] : seg.split(/\s+/)[0];
      if (name === "default") hasDefault = true;
      else named.add(name);
    }
  }

  // export * from "..."
  const starRe = /export\s*\*\s*from\s*["']([^"']+)["']/g;
  while ((m = starRe.exec(code))) star.push(resolveImport(m[1], filePath));

  return { named, hasDefault, star };
}

function resolveImport(spec, fromFile) {
  if (!spec.startsWith(".")) return null; // bare/vendor — ignora
  let p = resolve(dirname(fromFile), spec);
  if (existsSync(p) && statSync(p).isFile()) return p;
  if (existsSync(p + ".js")) return p + ".js";
  if (existsSync(join(p, "index.js"))) return join(p, "index.js");
  return p; // inexistente — sinalizado depois
}

const exportCache = new Map();
function getExports(filePath, seen = new Set()) {
  if (exportCache.has(filePath)) return exportCache.get(filePath);
  if (!existsSync(filePath)) return { named: new Set(), hasDefault: false, missing: true };
  const parsed = parseExports(readFileSync(filePath, "utf8"), filePath);
  const all = new Set(parsed.named);
  let hasDefault = parsed.hasDefault;
  for (const starPath of parsed.star) {
    if (!starPath || seen.has(starPath)) continue;
    seen.add(starPath);
    const sub = getExports(starPath, seen);
    for (const n of sub.named) all.add(n);
  }
  const result = { named: all, hasDefault, missing: false };
  exportCache.set(filePath, result);
  return result;
}

/** Extrai imports de um arquivo. */
function parseImports(src, filePath) {
  const code = stripComments(src);
  const imports = [];
  const re = /import\s+(?:([^;{}]*?)\s+from\s+)?["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(code))) {
    const clause = (m[1] || "").trim();
    const spec = m[2];
    if (!spec.startsWith(".")) continue; // vendor/CDN
    const names = [];
    let wantsDefault = false;
    let namespace = false;
    if (clause) {
      const braceMatch = clause.match(/\{([^}]*)\}/);
      if (braceMatch) {
        for (const part of braceMatch[1].split(",")) {
          const seg = part.trim();
          if (!seg) continue;
          const orig = seg.split(/\s+as\s+/)[0].trim();
          names.push(orig);
        }
      }
      if (/\*\s+as\s+/.test(clause)) namespace = true;
      const defMatch = clause.replace(/\{[^}]*\}/, "").replace(/\*\s+as\s+[A-Za-z0-9_$]+/, "").trim();
      if (defMatch.replace(/,/g, "").trim()) wantsDefault = true;
    }
    imports.push({ spec, names, wantsDefault, namespace, resolved: resolveImport(spec, filePath) });
  }
  return imports;
}

const files = walk(ROOT);
const problems = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const imp of parseImports(src, file)) {
    const rel = file.replace(ROOT, "js");
    if (!imp.resolved || !existsSync(imp.resolved)) {
      problems.push(`${rel}: caminho inexistente -> "${imp.spec}"`);
      continue;
    }
    const exp = getExports(imp.resolved);
    if (imp.namespace) continue; // namespace import: qualquer export serve
    if (imp.wantsDefault && !exp.hasDefault) {
      problems.push(`${rel}: import default de "${imp.spec}" mas modulo nao tem export default`);
    }
    for (const n of imp.names) {
      if (!exp.named.has(n)) {
        problems.push(`${rel}: "${n}" nao e exportado por "${imp.spec}"`);
      }
    }
  }
}

if (problems.length) {
  console.error(`\n[check-frontend-imports] ${problems.length} problema(s):\n`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`[check-frontend-imports] OK — ${files.length} arquivos, nenhum import/export quebrado.`);
