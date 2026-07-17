# Auditoria final — FinSight MVP Producao

Data: 2026-07-17

## Antes → Depois

| Area | Antes | Depois |
|------|-------|--------|
| Migrations | So no long-running, sem controle | `schema_migrations` + `npm run migrate` |
| Redis | 3 clientes / personalization so memoria | Client compartilhado (`src/platform/redis.js`) |
| TLS DB | `rejectUnauthorized: false` | `true` + CA opcional; insecure so emergencia |
| LGPD | Exclusao fake | Export, consent, delete/anonimizacao, privacy.html |
| Audit financeiro | Ausente | Tabela imutavel + trigger |
| Idempotencia | Ausente | Middleware + tabela |
| Concorrencia saldo | Sem lock | `SELECT FOR UPDATE` |
| Email verify | Opcional | Gate de login/API |
| Paginação | Ausente | Listagens com page/pageSize |
| Compressao | Ausente | gzip via `compression` |
| Health | So /health | /live + /ready |
| Testes/CI | Zero | Vitest + GitHub Actions |
| Observabilidade | Logs BFF | + requestId + Sentry stub |

## Problemas resolvidos (criticos/altos)

1. TLS Postgres sem verificacao de certificado
2. Seeds automaticos em producao
3. Cache/rate-limit fragmentados em serverless
4. Sem trilha financeira imutavel
5. Sem protecao a retries (duplicacao)
6. Race em saldo de contas
7. LGPD incompleta (export/delete/consent)
8. XSS em listagens principais do SPA
9. Payloads de listagem sem limite
10. Cron sem maxDuration / CSP estatico fraco
11. Zero testes e sem pipeline CI

## Riscos remanescentes

1. Redis ainda opcional — sem ele, rate-limit/cache por instancia
2. MFA apenas preparado (coluna), nao implementado
3. `app.js` ainda monolítico (lazy bootstrap parcial)
4. EXPLAIN ANALYZE precisa ser rodado em staging com dados reais
5. E2E Playwright e estrutura, nao suite ativa
6. Soft-delete em contas/cartoes ainda nao em todos os repositories de leitura
7. CSP com `unsafe-inline` em styles (CDN/fonts)
8. Access JWT pos-revoke: agora valida sessao no touch — OK; edge cases de clock skew

## Notas (0–10)

| Criterio | Nota |
|----------|------|
| Arquitetura | 8.0 |
| Seguranca | 8.0 |
| Banco de Dados | 7.5 |
| Performance | 7.0 |
| Frontend | 6.5 |
| Backend | 8.0 |
| UX | 7.0 |
| Escalabilidade | 7.5 |
| Prontidao para Producao | 7.5 |

**Veredito:** pronto para MVP em producao na Vercel **desde que** o checklist em `docs/ops/production-checklist.md` seja cumprido (migrate + secrets + Resend + Redis recomendado).
