# Arquitetura backend — FinSight

API Node/Express, **monólito modular**, runtime-agnostic (Vercel Serverless ou long-running: Docker/Railway/VPS). CommonJS.

## Entry points

| Arquivo | Papel |
|---------|-------|
| `src/server.js` | Boot long-running: migrations → bootstrap → scheduler → `app.listen` |
| `src/app.js` | Monta Express (middlewares globais, `/health`, `/api`, error handlers) |
| `api/[...path].js` | Handler serverless (Vercel) que reусa `src/app.js` |
| `api/cron/market.js` | Cron serverless de mercado |
| `src/routes/index.js` | Agregador das rotas `/api/*` (auth, admin, BFF, CRUDs) |

## Árvore

```
src/
├── app.js, server.js
├── config/            env.js, rate-limit.config.js, pagination.config.js
├── database/          pool, migrations, transaction, seed, migrate-cli, migrations/
├── middlewares/       *.middleware.js (authenticate, csrf, validate, paginate,
│                      idempotency, cron-auth, request-logger, security, error,
│                      rate-limit) + rate-limit.store.js
├── observability/     sentry.js
├── platform/          bootstrap, runtime, redis, httpHandler
├── routes/            index.js (agregador /api)
├── services/          serviços compartilhados entre módulos:
│                      balance.service, invoice.service, recurrence.service (domínio),
│                      pagination/, query/, rate-limit/, upload/ (infra)
├── utils/             AppError, asyncHandler, jwt, cookies, crypto, apiResponse,
│                      logger, demoUser, requestMeta
└── modules/           1 pasta por domínio (ver abaixo)
```

## Módulos de domínio (`src/modules/<domínio>/`)

accounts · admin · analytics · app · audit · auth · bff · cards · cron · dashboard ·
email · goals · health · investments · invoices · market-data · movements ·
personalization · privacy · recurrences · users

Cada módulo segue o padrão por responsabilidade:

| Sufixo | Papel |
|--------|-------|
| `<dominio>.routes.js` | Rotas Express do domínio |
| `<dominio>.controller.js` | HTTP: valida entrada, chama service, formata resposta |
| `<dominio>.service.js` | Regra de negócio |
| `<dominio>.repository.js` | Acesso a dados (SQL/pool) |
| `<dominio>.validator.js` | Schemas (zod) |

Submódulos maiores (ex.: `analytics/`, `personalization/`, `market-data/`, `bff/`)
têm subpastas próprias (`queries/`, `builders/`, `engine/`, `strategies/`, `services/`, `cache/`).

## Convenções de nomenclatura

- **Arquivos**: dot-notation por responsabilidade — `nome.papel.js`
  (`balance.service.js`, `security.middleware.js`, `rate-limit.config.js`).
- **Multi-palavra**: kebab-case (`market-data`, `rate-limit`, `cron-auth`, `request-logger`).
- **Classes**: mantêm PascalCase no `export` mesmo com arquivo em kebab
  (ex.: `safe-query-builder.js` exporta `SafeQueryBuilder`; `pagination.service.js` → `PaginationService`).

## Camadas de `services/`

- **Domínio compartilhado** (arquivos soltos): `balance/invoice/recurrence.service.js` —
  lógica reutilizada por vários módulos (movements, dashboard, cards, invoices, analytics).
- **Infra** (subpastas): `pagination/`, `query/`, `rate-limit/`, `upload/`.
  > `upload/upload.service.js` é um **stub intencional** (contrato estável) para Cloudinary/S3 futuro — não é código morto.

## Fluxo de requisição `/api`

`routes/index.js` → `/auth` e `/admin` públicos → `authenticate` + `csrf` →
BFF (uma chamada por tela) → CRUDs por domínio.

## Rate limit

- Config central: `config/rate-limit.config.js` (único lugar para ajustar limites).
- Middleware: `middlewares/rate-limit.middleware.js`.
- Store adaptativo (memória → Redis): `middlewares/rate-limit.store.js`.
- Serviço: `services/rate-limit/rate-limit.service.js`.

## Notas

- `/api/reports` é servido pelo **BFF** (`modules/bff`), não por um módulo `reports` dedicado.
- Health em `modules/health/` (liveness `/live`, readiness `/ready`, `/health`).

## O que não fazer

- Não recriar `src/controllers/` ou `src/routes/*Routes.js` soltos — cada domínio é um módulo.
- Não misturar camelCase/PascalCase em nomes de arquivo — usar dot-notation.
- Não achatar subpastas de `services/` de forma que quebre `require` internos sem reajustar profundidade.
