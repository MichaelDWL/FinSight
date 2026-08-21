# FASE 5 — Etapa 2: Deploy vs produção

## Causa raiz (MEDIDO)

| Fonte | `/home/secondary` |
|---|---|
| Working tree local | **Presente** (`bff.routes.js`) |
| `origin/main` | **Ausente** |
| Vercel LIVE (sem auth) | `401` em qualquer `/api/*` (authenticate antes do 404) |
| Vercel LIVE (com auth, FASE 4) | `404` — rota nao existia no deploy |

Conclusao: o 404 nao e rewrite/`vercel.json`/build ignore. O deploy aponta para codigo antigo (sem a rota).

## Por que probe sem cookie mostra 401

`backend/src/routes/index.js` aplica `authenticate` em todas as rotas apos `/auth` e `/admin`. Rotas inexistentes autenticadas retornam 404; sem sessao, retornam 401 antes do `notFound`.

## Correcao

1. Commit + push do working tree (inclui FASE 1–5 locais + CA TLS).
2. Vercel env (TLS Etapa 1):
   - `DATABASE_SSL=true`
   - `DATABASE_SSL_CA_FILE=backend/certs/supabase-root-2021-ca.crt`
   - remover `DATABASE_SSL_INSECURE` (ou `false`)
3. Redeploy.
4. Validar com sessao autenticada:

```text
GET /api/home              → 200
GET /api/home/secondary    → 200
GET /api/dashboard         → 200
GET /api/dashboard?section=overview → 200
GET /api/insights          → 200
GET /api/accounts          → 200
GET /api/transactions      → 200
GET /api/investments       → 200
GET /ready                 → ssl.rejectUnauthorized=true, caProvided=true
```

## O que NAO e o problema

- `vercel.json` rewrites `/api/(.*)` → `/api/[...path]` (OK)
- Catch-all `api/[...path].js` (OK)
- Frontend `bffService.getHomeSecondary` → `/home/secondary` (OK local)
