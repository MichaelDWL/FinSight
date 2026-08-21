# TLS / SSL do PostgreSQL (Supabase)

## Estado (FASE 5 — Etapa 1)

A CA **Supabase Root 2021** foi validada com handshake real (FASE 4):

- conexao direta `:5432` — OK (`rejectUnauthorized: true`)
- pooler `:6543` — OK (`rejectUnauthorized: true`)

Arquivo **publico** no repositorio (nao e segredo):

`backend/certs/supabase-root-2021-ca.crt`

O `.gitignore` **permite** esse arquivo (antes `certs/` bloqueava o deploy).

Com `DATABASE_SSL=true` e `DATABASE_SSL_INSECURE` ausente/`false`, o runtime carrega a CA nesta ordem:

1. `DATABASE_SSL_CA_FILE` (se definido e o arquivo existir)
2. `DATABASE_SSL_CA` (PEM via env)
3. **fallback bundled** `backend/certs/supabase-root-2021-ca.crt`

## Variaveis (Vercel Production)

| Variavel | Valor recomendado |
|---|---|
| `DATABASE_SSL` | `true` |
| `DATABASE_SSL_CA_FILE` | `backend/certs/supabase-root-2021-ca.crt` (opcional se bundled estiver no deploy) |
| `DATABASE_SSL_CA` | (alternativa) PEM com `\n` literais |
| `DATABASE_SSL_INSECURE` | **remover** ou `false` |

## Validar localmente

```bash
node --env-file=backend/.env.supabase scripts/verify-db-ssl.mjs --ca-file=backend/certs/supabase-root-2021-ca.crt
node scripts/verify-pooler-ssl.mjs --ca-file=backend/certs/supabase-root-2021-ca.crt
```

Exit code `0` + `"ok": true` = TLS validado.

## Checklist Vercel (obrigatorio apos merge/deploy)

1. Commit inclui `backend/certs/supabase-root-2021-ca.crt` (trackeado no git).
2. Environment Variables (Production):
   - `DATABASE_SSL=true`
   - `DATABASE_SSL_CA_FILE=backend/certs/supabase-root-2021-ca.crt` (recomendado)
   - **Remover** `DATABASE_SSL_INSECURE` (ou definir `false`)
3. Redeploy (novo build — env so aplica em deploy novo).
4. Confirmar `GET /ready`:

```json
"ssl": {
  "enabled": true,
  "rejectUnauthorized": true,
  "caProvided": true,
  "caSource": "file"
}
```

`caSource` pode ser `"file"`, `"env"` ou `"bundled"`. Qualquer um com `caProvided: true` e `rejectUnauthorized: true` e sucesso.

`/ready` **nao** expoe PEM, URL do banco nem secrets.

## Codigo

- `backend/src/database/sslConfig.js`
- `backend/src/database/pool.js`
- `backend/src/config/env.js`
