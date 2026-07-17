# Checklist de producao — FinSight MVP

## Pre-deploy

- [ ] Postgres gerenciado (Neon/Supabase) com `docs/database/schema.sql` aplicado
- [ ] `npm run migrate` executado contra o banco de producao
- [ ] Secrets fortes: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET` (>=32 / >=16)
- [ ] `DATABASE_SSL=true` e `DATABASE_SSL_INSECURE` **nao** definido (ou false)
- [ ] `CORS_ORIGIN` = URL do frontend na Vercel
- [ ] `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax` (mesmo dominio)
- [ ] `REDIS_URL` (Upstash) — fortemente recomendado
- [ ] `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + dominio verificado
- [ ] `ALLOW_ADMIN_SEED` ausente ou false
- [ ] `REQUIRE_EMAIL_VERIFIED=true`
- [ ] `SENTRY_DSN` opcional configurado + `@sentry/node` instalado

## Pos-deploy

- [ ] `GET /live` → 200
- [ ] `GET /ready` → 200
- [ ] Login + registro + verify email
- [ ] Criar movimentacao com `Idempotency-Key`
- [ ] Exportar dados (LGPD) e validar JSON
- [ ] Cron Vercel `/api/cron/market` com Bearer
- [ ] Confirmar CSP headers no HTML estatico

## Rollback

1. Redeploy release anterior na Vercel
2. Se migration quebrou: restore dump (`docs/ops/backup-restore.md`)
3. Rotacionar secrets se necessario (`docs/ops/disaster-recovery.md`)
