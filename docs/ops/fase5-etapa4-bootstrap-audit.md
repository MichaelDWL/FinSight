# FASE 5 — Etapa 4: Auditoria de bootstrap

## Escopo

Mapear o que carrega no **cold start** da Function (`api/[...path].js` → `app.js`).

**Nenhuma otimizacao aplicada nesta etapa** (lazy-load = Etapa 5).

## Cadeia de boot (serverless)

```
api/[...path].js
  → platform/httpHandler.js
    → app.js
      → initSentry() (no-op sem SENTRY_DSN)
      → express + security + compression + morgan + json + cookies
      → requestLogger → requestMeta → ua-parser-js
      → bootstrapMiddleware (ensureReady na 1a request)
      → health.controller → database/pool (Pool criado no module scope)
      → cron.routes
      → routes/index.js  ★ carrega TODA a API
           → auth → auth.service → utils/crypto → argon2
           → csrf.middleware → utils/crypto → argon2
           → bff + accounts + cards + dashboard + … + market + …
```

`ensureReady()` (1a request): `initCache` + `CacheService.init` + `require(personalization)` + `wirePersonalizationEvents`.

`node-cron` / `market.scheduler`: **nao** entram pelo path Vercel (so `server.js` long-running).

Excel / Chart.js / puppeteer: **ausentes** das dependencies.

## Medicao LOCAL de require (NAO e producao)

Script: `node scripts/measure-bootstrap.mjs`  
Maquina Windows, Node local, 3 rounds, processo filho isolado.  
**NAO usar como benchmark Vercel.**

| Componente | Carregado no cold start | Peso/tempo (p50 LOCAL) | Necessario no bootstrap? |
|---|---|---:|---|
| `app.js` (grafo completo) | Sim | **454 ms** | Sim (entry) |
| `routes/index` (toda API) | Sim | **420 ms** | Parcial — roteador sim; CRUD/market/admin nao para `/api/home` |
| `bff/routes` (+ deps) | Sim | **287 ms** | Sim para BFFs |
| `express` | Sim | **109 ms** | Sim |
| `market.scheduler` | **Nao** (Vercel) | 79 ms se carregado | Nao no serverless |
| `investments.service` | Sim (via routes) | **78 ms** | Nao para home/accounts |
| `personalization/index` | Sim (routes + ensureReady) | **67 ms** | Parcial (home/insights) |
| `jsonwebtoken` | Sim (auth/authenticate) | **63 ms** | Sim para API autenticada |
| `zod` (1o validator) | Sim | **57 ms** | Parcial (validators de rotas nao usadas) |
| `pg` / `database/pool` | Sim | **55 ms** | Sim (DB) |
| `helmet+cors+compression` | Sim | **28 ms** | Sim |
| `csrf.middleware` → crypto | Sim | **19 ms** | Parcial (GET nao valida CSRF; **puxa argon2**) |
| `argon2` (native) | Sim (via crypto) | **16 ms** | **Nao** para GET BFF / login-only |
| `utils/crypto` | Sim | **8 ms** | Parcial |
| `ua-parser-js` / requestMeta | Sim (request-logger) | **7 ms** | Nao critico |
| `platform/bootstrap` modulo | Sim | **6 ms** | Sim |

### Profile aninhado (1 load `app.js`, LOCAL)

Top relativo: `routes` ~288 ms, `express` ~111 ms, `accounts.routes`/zod ~55–78 ms, `auth`+jwt ~38–55 ms, `personalization` ~46 ms, `pool` ~34 ms.

## Side-effects no module scope (MEDIDO por leitura de codigo)

| Item | Side-effect | Impacto |
|---|---|---|
| `pool.js` | `new Pool(...)` imediato | TLS/DNS na 1a query /ready |
| `app.js` | `initSentry()` | no-op sem DSN |
| `personalization/index` | `wirePersonalizationEvents()` | registradores em memoria |
| `rate-limit.store` | log de modo memory | leve |
| `crypto.js` | `require("argon2")` | native no cold path |

## Producao (contexto Etapa 3)

| Sinal | Tipo | Valor |
|---|---|---|
| `/ready` cold wall | MEDIDO | ~1047 ms |
| `/ready` cold dbMs | MEDIDO | ~46 ms |
| Require LOCAL app | MEDIDO local | ~450 ms |
| Fracao do cold Vercel = require | ESTIMADO | parte dos ~1000 ms; resto = Vercel isolate + rede |
| argon2 em Vercel cold | NÃO MEDIDO isolado | HIPOTESE: maior que 16 ms local (native) |

## Candidatos Etapa 5 (so com evidencia — ainda NAO alterar)

1. **Lazy `argon2`** em `utils/crypto.js` — CSRF so precisa `timingSafeEqualString`.
2. **Nao carregar rotas CRUD/market/admin** no mesmo grafo da 1a Function (split ou lazy `require` de routers) — maior alavanca LOCAL (~420 ms routes).
3. Lazy `ua-parser-js` no request-logger (so se logar device).
4. Evitar re-require redundante de personalization se ja no grafo de routes.

## O que NAO vale a pena

- Remover express/pg/jwt do boot autenticado.
- Adicionar Excel/charts (nao existem).
- Otimizar `market.scheduler` no path Vercel (ja fora).
