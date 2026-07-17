# Arquitetura FinSight (MVP Serverless-ready)

## Principios

1. **Negocio independente de plataforma** — Services/Repositories nao importam Express nem Vercel.
2. **Adapters finos** — `api/*` so encaminha HTTP para o app Express.
3. **Uma Function catch-all** — evita estourar limite do plano gratuito e reduz cold starts.
4. **BFF agregado** — 1 request por tela (`/api/home`, `/api/dashboard`, ...).
5. **Mercado via Cron HTTP** — paginas leem so o PostgreSQL; APIs externas so no job diario.
6. **Migracao** — o mesmo `src/app.js` sobe com `listen` em Docker/Railway/VPS.

## Estrutura

```
FinSight/
  api/                      # Adapters Serverless (sem regra de negocio)
    [...path].js            # Catch-all → Express
    cron/market.js          # Vercel Cron → /api/cron/market
  src/                      # Codigo de negocio + HTTP app
    platform/               # runtime, bootstrap, httpHandler
    modules/                # dominio (auth, bff, market-data, cron, ...)
    middlewares/rateLimit/  # store memoria → Redis
    services/upload/        # UploadService (Cloudinary futuro)
    config/env.js
    server.js               # long-running only
  frontend/                 # SPA estatica
  backend/                  # .env, scripts auxiliares (compat)
  Dockerfile                # build a partir da raiz
  vercel.json
  package.json              # deps + scripts na raiz
  docker-compose.yml        # Postgres + API + Redis (RUNTIME=long)
```

## Fluxos

### Request de pagina
Browser → `/api/home` → `api/[...path].js` → Express → BFF Controller → Services → Repositories → PostgreSQL

### Mercado (03:00 BRT = 06:00 UTC)
Vercel Cron → `GET /api/cron/market` + `Authorization: Bearer $CRON_SECRET`
→ MarketSyncJob → BCB → BRAPI → PostgreSQL → fim

### Local / Docker
`npm start` (raiz) → `src/server.js` → migrations → bootstrap → `listen` → node-cron (se habilitado)

## Rate limit

Store adaptativo (`src/middlewares/rateLimit/store.js`):
- Sem `REDIS_URL`: memoria (dev / single instance)
- Com Redis: promove automaticamente no bootstrap (compartilhado entre instancias)

## Variaveis criticas (Vercel)

| Var | Uso |
|-----|-----|
| `DATABASE_URL` | Postgres (Neon/Supabase recomendado no MVP) |
| `DATABASE_SSL=true` | quase sempre em managed Postgres |
| `DATABASE_SSL_CA` | opcional — PEM do CA do provedor |
| `CRON_SECRET` | protege o job; Vercel envia Bearer automaticamente |
| `JWT_*` / `COOKIE_*` | auth |
| `CORS_ORIGIN` | URL do frontend na Vercel |
| `REDIS_URL` | **recomendado** em producao (cache + rate-limit compartilhado; Upstash) |
| `RUNTIME` | omitir (auto) ou `serverless` |
| `ALLOW_ADMIN_SEED` | nunca `true` em producao rotineira |
| `EMAIL_PROVIDER=resend` | + `RESEND_API_KEY` em producao |
| `SENTRY_DSN` | opcional (observabilidade) |

## Deploy checklist (Vercel)

1. Aplicar schema inicial (`docs/database/schema.sql`) no Postgres gerenciado (uma vez).
2. `DATABASE_URL` + secrets no painel Vercel.
3. Rodar migrations **fora** do request: `npm run migrate` (CI ou maquina com acesso ao DB).
4. Configurar `REDIS_URL` (Upstash) — sem Redis, cache/rate-limit ficam por instancia.
5. Confirmar Cron `/api/cron/market` + `CRON_SECRET`.
6. Smoke: `/live`, `/ready`, login.

## Migrar para Railway / VPS / Fly

1. Subir com `RUNTIME=long` (`Dockerfile` na raiz).
2. Apontar o frontend para a URL da API (ou reverse proxy `/api`).
3. Trocar Vercel Cron por crontab chamando `/api/cron/market` **ou** manter `MARKET_SCHEDULER_ENABLED=true`.
4. `REDIS_URL` no Compose/servico.
5. Nenhuma mudanca em Services/Repositories.

## Ops

- Backup/restore: `docs/ops/backup-restore.md`
- Disaster recovery: `docs/ops/disaster-recovery.md`

