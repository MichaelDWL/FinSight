# Manual de Deploy — FinSight

Documento oficial de implantação para produção com **Vercel** (frontend + Serverless Functions), **Supabase PostgreSQL**, **Upstash Redis**, **Resend** e **Vercel Cron**.

**Stack alvo**

- Frontend: Vercel (estático)
- Backend: Vercel Serverless Functions
- Banco: Supabase PostgreSQL
- Redis: Upstash Redis
- E-mail: Resend
- Cron: Vercel Cron
- Repositório: GitHub

**Referências relacionadas**

| Documento | Uso |
|-----------|-----|
| [production-checklist.md](./production-checklist.md) | Checklist curto pré/pós-deploy |
| [backup-restore.md](./backup-restore.md) | Backup e restore PostgreSQL |
| [disaster-recovery.md](./disaster-recovery.md) | RTO/RPO e runbook de DR |
| [audit-final-mvp.md](./audit-final-mvp.md) | Notas e riscos remanescentes |
| [../architecture-serverless.md](../architecture-serverless.md) | Arquitetura serverless |
| `vercel.json` (raiz) | Functions, cron, headers, rewrites |
| `backend/.env.example` | Catálogo de variáveis |

---

# 1. Resumo Geral

| Pergunta | Resposta |
|----------|----------|
| Pronto para deploy? | **Condicionalmente sim** — o código já é serverless-ready, mas o deploy só é seguro após cumprir o checklist pré-deploy (migrations, secrets, Resend, Redis, SSL). |
| Nível de prontidão | **MVP Production-ready com ressalvas** |
| Nota (0–10) | **7,5 / 10** |
| Riscos remanescentes | Redis opcional (sem ele, rate-limit/cache por instância); Hobby Cron 1x/dia com precisão ±59 min; cold start + Argon2; upload ainda stub; MFA não implementado; E2E Playwright não é suite ativa; purge de mercado pode referenciar nomes de tabela divergentes do schema. |

**Veredito:** o projeto **pode** ir para produção como MVP financeiro, desde que o operador execute migrations fora do request path, configure secrets fortes, Resend com domínio verificado e Upstash Redis. Sem isso, é **No-Go**.

---

# 2. Arquitetura

```text
Browser (SPA frontend/)
        │
        │  same-origin /api  (produção)
        ▼
Vercel Edge / Static
  • frontend/index.html + js/ + style/
  • CSP / security headers (vercel.json)
        │
        ▼
Serverless Functions
  • api/[...path].js  → Express (src/app.js)
  • api/cron/market.js → mesmo handler + rota cron
        │
        ▼
Bootstrap lazy (src/platform/bootstrap.js)
  • Redis Upstash
  • Cache BFF / Analytics
  • Rate-limit store → Redis
        │
        ▼
Camadas da API
  Routes → Controllers → BFF / Services → Repositories
        │
        ├──► Supabase PostgreSQL (pg Pool, SSL)
        ├──► Upstash Redis (cache + rate-limit)
        ├──► Resend (e-mail transacional)
        └──► APIs externas (somente no Cron diário)
                 • Banco Central (BCB/SGS)
                 • BRAPI
                 • Stooq (fallback)
```

**Princípios já implementados**

- Negócio em `src/`; adapters finos em `api/`
- Uma Function catch-all (menos cold starts / limite de functions)
- BFF screen-driven (`/api/home`, `/api/dashboard`, …)
- Mercado **não** é chamado a cada pageview — só no job diário
- Runtime-agnostic: `RUNTIME=serverless` (Vercel) ou `long` (Docker)

---

# 3. Estrutura do Deploy

```text
GitHub (main)
        │
        │  push / PR → GitHub Actions (lint, schema, migrate, vitest)
        ▼
Vercel Project
  Build: npm install
  Output: static frontend + Serverless Functions
        │
        ├── Frontend estático (rewrites → frontend/*)
        ├── api/[...path]  (API + BFF + Auth + Admin + Privacy)
        └── api/cron/market (Vercel Cron 0 6 * * * UTC)
                │
                ├── Supabase PostgreSQL (dados + migrations)
                ├── Upstash Redis (cache BFF, analytics, rate-limit)
                ├── Resend (welcome, verify, reset)
                └── BCB / BRAPI / Stooq (sync diário → Postgres)
```

**Região configurada:** `iad1` (US East) em `vercel.json`. Ideal alinhar Supabase/Upstash à mesma região (ou a mais próxima) para latência.

---

# 4. Variáveis de Ambiente

### Legenda

- **Obrigatória?** = necessária para produção estável
- **Código usa?** = lida por `src/config/env.js` ou infra

| Nome | Obrigatória? | Código usa? | Descrição | Exemplo | Dev | Prod |
|------|--------------|-------------|-----------|---------|-----|------|
| `NODE_ENV` | Sim | Sim | Ambiente Node | `production` | `development` | `production` |
| `RUNTIME` | Não | Sim | Força runtime | `serverless` | omitir / `long` | omitir (auto via `VERCEL`) |
| `PORT` | Não | Sim | Listen local | `3045` | `3045` | N/A na Vercel |
| `DATABASE_URL` | **Sim** | Sim | Connection string Postgres | `postgresql://postgres.…@aws-0-….pooler.supabase.com:6543/postgres` | Local Docker | **Pooler Supabase (6543)** |
| `DATABASE_SSL` | **Sim** (prod) | Sim | Habilita TLS | `true` | `false` | `true` |
| `DATABASE_SSL_CA` | Recomendada | Sim | PEM do CA (opcional se CAs do sistema ok) | `-----BEGIN CERTIFICATE-----…` | — | Se TLS falhar |
| `DATABASE_SSL_INSECURE` | **Nunca** em prod rotina | Sim | Desliga verificação de cert | `false` | — | **ausente/false** |
| `DB_POOL_MAX` | Não | Sim | Pool long-running | `10` | `10` | `10` |
| `DB_POOL_MAX_SERVERLESS` | Recomendada | Sim | Pool por instância serverless | `2` | — | `1` ou `2` |
| `REDIS_URL` | **Fortemente recomendada** | Sim | Upstash Redis | `rediss://default:…@….upstash.io:6379` | opcional | **Sim** |
| `JWT_ACCESS_SECRET` | **Sim** | Sim | Assinatura access JWT (≥32, forte) | `base64url 48 bytes` | dev fraco ok | **forte** |
| `JWT_REFRESH_SECRET` | **Sim** | Sim | Assinatura refresh JWT | idem | dev | **forte** |
| `JWT_ACCESS_EXPIRES_IN` | Não | Sim | TTL access | `15m` | `15m` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Não | Sim | TTL refresh | `7d` | `7d` | `7d` |
| `CRON_SECRET` | **Sim** | Sim | Bearer do Cron (≥16) | random 32+ | dev | **forte** (Vercel injeta Bearer) |
| `CORS_ORIGIN` | **Sim** | Sim | Origem(ns) do frontend | `https://finsight.vercel.app` | `http://localhost:5500` | URL canônica + custom domain |
| `COOKIE_SECURE` | **Sim** | Sim | Cookie só HTTPS | `true` | `false` | `true` |
| `COOKIE_SAME_SITE` | **Sim** | Sim | SameSite | `lax` | `lax` | `lax` (mesmo domínio) |
| `COOKIE_DOMAIN` | Não | Sim | Domínio do cookie | `.seudominio.com` | — | só se subdomínios |
| `CSRF_ENABLED` | Sim | Sim | CSRF double-submit | `true` | `true` | `true` |
| `EMAIL_PROVIDER` | **Sim** | Sim | Provider de e-mail | `resend` | `console` | `resend` |
| `RESEND_API_KEY` | **Sim** (com Resend) | Sim | API key Resend | `re_…` | — | **Sim** |
| `EMAIL_FROM` | **Sim** | Sim | Remetente verificado | `FinSight <noreply@seudominio.com>` | local | domínio Resend |
| `APP_PUBLIC_URL` | **Sim** | Sim | Links de e-mail / app | `https://app.seudominio.com` | localhost | URL pública |
| `REQUIRE_EMAIL_VERIFIED` | Sim | Sim | Bloqueia login sem verify | `true` | `true`/`false` testes | `true` |
| `PRIVACY_POLICY_VERSION` | Não | Sim | Versão do consentimento LGPD | `1.0` | `1.0` | atualizar ao mudar política |
| `ALLOW_ADMIN_SEED` | **Não em prod** | Sim | Seed de admin no migrate | `false` | `true` (1ª vez) | **ausente/false** |
| `ADMIN_SEED_NAME` | Só se seed | Sim | Nome admin seed | `Administrador` | ok | só bootstrap controlado |
| `ADMIN_SEED_EMAIL` | Só se seed | Sim | E-mail admin | `admin@…` | ok | só bootstrap |
| `ADMIN_SEED_PASSWORD` | Só se seed | Sim | Senha ≥12 forte | — | forte | só bootstrap; depois rotacionar |
| `LOGIN_MAX_ATTEMPTS` | Não | Sim | Lockout | `5` | `5` | `5` |
| `LOGIN_LOCK_MINUTES` | Não | Sim | Duração lock | `15` | `15` | `15` |
| `PASSWORD_RESET_EXPIRES_MINUTES` | Não | Sim | TTL reset | `30` | `30` | `30` |
| `EMAIL_VERIFY_EXPIRES_HOURS` | Não | Sim | TTL verify | `24` | `24` | `24` |
| `RATE_LIMIT_*` | Não | Sim | Limites HTTP | ver `.env.example` | defaults | defaults ou mais restritos |
| `MARKET_SCHEDULER_ENABLED` | Não | Sim | node-cron in-process | `false` na Vercel | `true` local | omitir/`false` (usa HTTP cron) |
| `MARKET_DATA_RETENTION_DAYS` | Não | Sim | Purge histórico | `365` | `365` | `365` |
| `BRAPI_TOKEN` | Recomendada | Sim | Token BRAPI (ativos além do free) | `…` | opcional | recomendada |
| `UPLOAD_PROVIDER` | Não | Sim | Uploads | `stub` | `stub` | `stub` até Cloudinary |
| `CLOUDINARY_*` | Não (MVP) | Sim | Futuro upload | — | — | quando ativar |
| `SENTRY_DSN` | Recomendada | Sim | Observabilidade | `https://…@sentry.io/…` | — | recomendada |
| `SUPABASE_URL` | **Não** | **Não** | URL projeto Supabase | `https://xxx.supabase.co` | — | opcional (painel/docs) |
| `SUPABASE_ANON_KEY` | **Não** | **Não** | Client key (Auth/Realtime) | `eyJ…` | — | **não usada pelo app atual** |
| `SUPABASE_SERVICE_ROLE_KEY` | **Não** | **Não** | Service role | `eyJ…` | — | **não usada; nunca no frontend** |

> O FinSight conecta ao Postgres via `pg` + `DATABASE_URL`. **Não** usa Supabase Auth/RLS/JS SDK. As chaves `SUPABASE_*` são úteis só para operação humana no painel, não para a app.

### Geração de secrets (local)

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Gerar **três** valores distintos: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET`.

---

# 5. Configuração da Vercel

### Já existe no repo (`vercel.json`)

| Item | Valor atual |
|------|-------------|
| `installCommand` | `npm install` |
| `regions` | `["iad1"]` |
| Functions | `api/[...path].js` maxDuration **30s**, memory **1024** |
| Cron Function | `api/cron/market.js` maxDuration **60s**, memory **1024** |
| Cron schedule | `0 6 * * *` (06:00 UTC ≈ 03:00 BRT) |
| Rewrites | `/api/*` → catch-all; `/live`,`/ready`,`/health`; static `frontend/` |
| Headers | CSP, `X-Frame-Options: DENY`, nosniff, Permissions-Policy |

### Configurar no painel Vercel

1. **Import Project** a partir do GitHub (root do monorepo).
2. **Framework Preset:** Other / sem framework.
3. **Root Directory:** `.` (raiz).
4. **Build Command:** deixar vazio (ou `echo "no build"`) — SPA estática + Functions Node.
5. **Output Directory:** deixar vazio (rewrites apontam para `frontend/`).
6. **Install Command:** `npm install` (já no `vercel.json`).
7. **Node.js Version:** **20.x** (`engines` do `package.json`).
8. **Environment Variables:** colar a tabela da seção 4 (Production + Preview se desejar).
9. **Cron Jobs:** Settings → Cron Jobs — deve listar `/api/cron/market` após o deploy. Confirmar `CRON_SECRET` no Environment.
10. **Domains:** adicionar domínio custom; atualizar `CORS_ORIGIN` e `APP_PUBLIC_URL`.
11. **Deployment Protection:** desligar Vercel Authentication na Production se usuários reais acessarem (ou usar só em Preview).

### Limites Hobby relevantes

| Recurso | Hobby | Impacto FinSight |
|---------|-------|------------------|
| Cron | **1x/dia** máximo; precisão ±59 min | Schedule atual `0 6 * * *` é válido |
| Function duration | até **300s** | 30s/60s no `vercel.json` OK |
| Runtime logs | ~1 hora | Logs curtos — usar Sentry |
| Deployments/dia | 100 | Suficiente MVP |

### Cache

- Estático: Vercel CDN para `frontend/js` e `style`.
- API: cache de aplicação via Upstash (BFF TTLs), não CDN cache de `/api` (cookies/auth).

---

# 6. Configuração do Supabase

| Tema | Recomendação |
|------|----------------|
| **Projeto** | Criar em região próxima de `iad1` (ex.: East US) |
| **Banco** | Postgres gerenciado do projeto (não usar Auth do Supabase para o MVP) |
| **SSL** | Sempre; na app: `DATABASE_SSL=true` |
| **Connection string Runtime** | **Transaction pooler** porta **6543** (`?pgbouncer=true` se exigido) |
| **Connection string Migrations** | **Direct** porta **5432** (session) — `npm run migrate` na máquina/CI |
| **Pool** | Serverless: `DB_POOL_MAX_SERVERLESS=1` ou `2` para não esgotar slots Free |
| **Backup** | Ativar PITR se plano permitir; no Free, export periódico ([backup-restore.md](./backup-restore.md)) |
| **Roles** | App usa um usuário com DML; não expor `service_role` no frontend |
| **RLS** | App faz isolamento por `usuario_id` no código; RLS opcional futuro (não obrigatório agora) |
| **Extensões** | `pgcrypto` (já no `schema.sql`) |
| **Timezone** | `America/Sao_Paulo` nas configs de usuário; DB em UTC (padrão) |
| **Network** | Sem restrição de IP no Free; em Pro, considerar allowlist se disponível |

### Passos Supabase

1. Create project → copiar Database password.
2. Settings → Database → Connection string **URI**.
3. Usar **Pooler** para `DATABASE_URL` na Vercel.
4. Localmente/CI com direct URL: aplicar `docs/database/schema.sql` + `npm run migrate`.
5. Confirmar `SELECT * FROM schema_migrations ORDER BY applied_at;`.

---

# 7. Banco de Dados

### Como subir corretamente (ordem obrigatória)

```text
1) Criar projeto Supabase
2) Obter DATABASE_URL (direct 5432) para bootstrap
3) psql "$DATABASE_URL_DIRECT" -f docs/database/schema.sql
4) DATABASE_URL=... DATABASE_SSL=true npm run migrate
5) (Opcional, só 1ª vez) ALLOW_ADMIN_SEED=true no migrate — depois desligar
6) Trocar DATABASE_URL da Vercel para pooler 6543
7) Validar: SELECT count(*) FROM usuarios; SELECT * FROM schema_migrations;
```

### O que o schema + migrations cobrem

- **Core:** `usuarios`, `contas`, `categorias`, `movimentacoes`, `cartoes`, `faturas`, `parcelas`, `recorrencias`, `metas`, `orcamentos`, `tags`, `investimentos`, …
- **Auth:** `sessoes_usuario`, `tokens_refresh`, reset/verify, `logs_auditoria`, papéis, lockout, `excluido_em`
- **Market:** `market_data`, `economic_rates`, history, watchlist, quote_log, provider_status
- **Analytics:** views `vw_analytics_*`, snapshots, índices financeiros
- **Personalização:** `perfil_financeiro`, `regras_orcamento`, `historico_saude_financeira`
- **Produção recente:** `schema_migrations`, `logs_auditoria_financeira`, `idempotency_keys`, `consentimentos_lgpd`
- **Índices / triggers / CHECKs / ENUMs:** presentes no schema e migrations idempotentes
- **Seeds:** demo em `schema.sql` (cuidado — ambiente limpo de prod idealmente sem dados fictícios); admin seed só com `ALLOW_ADMIN_SEED=true`

### Atenção

- Migrations **nunca** no cold start da Function — só `npm run migrate` (CLI/CI).
- Bootstrap serverless **não** roda migrations (`src/platform/bootstrap.js`).

---

# 8. Cron Jobs

| Item | Configuração |
|------|----------------|
| Path | `/api/cron/market` |
| Schedule | `0 6 * * *` (UTC) |
| Handler | `api/cron/market.js` → Express → `verifyCronSecret` → `runDailySync` |
| Proteção | `Authorization: Bearer $CRON_SECRET` (Vercel injeta automaticamente se a env existir) |
| Timeout | `maxDuration: 60` |
| Retries Vercel | **Não retenta** em falha — monitorar logs |
| Monitoramento | Vercel → Cron Jobs → View Logs; logger `Cron market disparado`; `/ready` |

### Teste manual

```bash
curl -X POST "https://SEU_DOMINIO/api/cron/market" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Hobby

- Apenas **1 execução/dia** — ok para o schedule atual.
- Horário pode cair em qualquer minuto da hora 06 UTC.

---

# 9. APIs Externas

| Provider | Uso | Controles no código |
|----------|-----|---------------------|
| **BCB (SGS)** | SELIC, IPCA, CDI, FX | timeout ~12s, retry, circuit breaker, persistência |
| **BRAPI** | Cotação ações/FIIs/ETFs | token opcional; fallback |
| **Stooq** | Fallback de quotes/histórico | CSV + timeout |
| Cache | TTL watchlist / DB `market_data` | páginas leem Postgres |
| Persistência | `market_*`, `economic_*`, `market_provider_status` | sim |
| Fallback | Registry/executor multi-provider | sim |

**Regra de ouro em produção:** usuário final **não** deve depender da BRAPI em tempo real no request da tela — só dados já persistidos pelo Cron.

---

# 10. Segurança

Checklist de produção:

- [ ] HTTPS (Vercel + domínio)
- [ ] SSL Postgres (`DATABASE_SSL=true`, sem `DATABASE_SSL_INSECURE`)
- [ ] CSP (headers Vercel + Helmet API)
- [ ] Cookies HttpOnly + Secure + SameSite=Lax
- [ ] JWT access/refresh com secrets fortes e audiências distintas
- [ ] CSRF double-submit (`CSRF_ENABLED=true`)
- [ ] CORS com origem explícita (`CORS_ORIGIN`)
- [ ] Rate Limit + Slow Down (Redis em prod)
- [ ] Redis Upstash configurado
- [ ] Helmet ativo
- [ ] Idempotência (`Idempotency-Key` em mutações críticas)
- [ ] Auditoria (`logs_auditoria` + financeira)
- [ ] Logs estruturados + requestId (+ Sentry se possível)
- [ ] LGPD (consent, export, delete/anonimização, `privacy.html`)
- [ ] Verificação de e-mail (`REQUIRE_EMAIL_VERIFIED=true`)
- [ ] Password policy (mín. 8 + letras/números; reforçar depois)
- [ ] Secrets só na Vercel Env (nunca commit)
- [ ] Sessões com rotação de refresh + revoke family
- [ ] XSS mitigado nas listagens principais (revisar regressões)
- [ ] SQL Injection mitigado (queries parametrizadas)
- [ ] Clickjacking (`X-Frame-Options: DENY` / `frame-ancestors 'none'`)
- [ ] Cron protegido por `CRON_SECRET`
- [ ] `ALLOW_ADMIN_SEED` desligado em produção
- [ ] Admin RBAC nas rotas `/api/admin`

---

# 11. Performance

| Tema | Estado atual | Ação em prod |
|------|--------------|--------------|
| Paginação | Middleware `paginate` em listagens | Manter pageSize baixo |
| Compressão | `compression` (≥1KB) | OK |
| Cache BFF | TTLs por endpoint + Redis | **REDIS_URL obrigatório prático** |
| Lazy loading FE | Templates + modules + `core/store`/`events` | Ver `docs/frontend-architecture.md` |
| Payload | BFF agregado | Evitar N+1 no FE |
| SQL | Views analytics + índices | Rodar `EXPLAIN` em staging (`docs/database/query-plan.md`) |
| Pool serverless | max 1–2 conexões | Usar pooler Supabase |
| Cold start | Express + bootstrap Redis | Aceitável MVP; monitorar p95 |
| Cron | 60s / sync diário | Observar duração no log |

---

# 12. Checklist Pré-Deploy

### Contas e infra

- [ ] Criar repositório GitHub e branch `main` protegida
- [ ] Criar projeto na Vercel e conectar GitHub
- [ ] Criar projeto no Supabase (região alinhada)
- [ ] Criar database Upstash Redis (`rediss://`)
- [ ] Criar conta Resend + verificar domínio
- [ ] Comprar/apontar domínio (opcional no 1º deploy)

### Banco

- [ ] Aplicar `docs/database/schema.sql` (direct URL)
- [ ] Executar `npm run migrate` com SSL
- [ ] Confirmar `schema_migrations`
- [ ] Seed admin **apenas se necessário**, depois `ALLOW_ADMIN_SEED=false`
- [ ] Trocar URL da app para **pooler 6543**
- [ ] Testar restore de dump em staging ([backup-restore.md](./backup-restore.md))

### Variáveis Vercel (Production)

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` (pooler) + `DATABASE_SSL=true`
- [ ] `REDIS_URL`
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- [ ] `CRON_SECRET`
- [ ] `CORS_ORIGIN` = URL final
- [ ] `APP_PUBLIC_URL` = URL final
- [ ] `COOKIE_SECURE=true` / `COOKIE_SAME_SITE=lax`
- [ ] `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `EMAIL_FROM`
- [ ] `REQUIRE_EMAIL_VERIFIED=true`
- [ ] `ALLOW_ADMIN_SEED` ausente/false
- [ ] `BRAPI_TOKEN` (recomendado)
- [ ] `SENTRY_DSN` (recomendado)
- [ ] `DB_POOL_MAX_SERVERLESS=2`

### Domínio / DNS

- [ ] Configurar domínio na Vercel
- [ ] DNS A/CNAME conforme painel
- [ ] Atualizar `CORS_ORIGIN` e `APP_PUBLIC_URL` após domínio
- [ ] SPF/DKIM no Resend para o domínio

### Validação local/CI

- [ ] CI verde (`.github/workflows/ci.yml`)
- [ ] `npm test` / `npm run test:smoke`
- [ ] Revisar [production-checklist.md](./production-checklist.md)

### Testes funcionais (staging/preview)

- [ ] Login / registro / verify e-mail
- [ ] Reset de senha (e-mail chega)
- [ ] CSRF em mutações
- [ ] Dashboard / Home BFF
- [ ] Investimentos + mark-to-market após cron
- [ ] Contas / cartões / movimentação com `Idempotency-Key`
- [ ] Exportação LGPD + exclusão/anonimização
- [ ] Admin (listar/suspender)
- [ ] Cron manual com Bearer
- [ ] Rate limit (login)
- [ ] Cache HIT/MISS (`X-BFF-Cache`)
- [ ] Auditoria
- [ ] Upload: apenas se sair de `stub` (hoje esperado stub)

---

# 13. Checklist Pós-Deploy

- [ ] `GET /live` → 200
- [ ] `GET /ready` → 200 (`database: connected`)
- [ ] `GET /health` → ok
- [ ] Logs Vercel sem erro no boot
- [ ] Banco: inserts reais de um usuário de teste
- [ ] Cron: execução listada + log “Market sync”
- [ ] E-mail Resend: delivery de verify/reset
- [ ] Redis: `redis: connected` no bootstrap / ready
- [ ] SSL do site (cadeado) + cookies `Secure`
- [ ] Dashboard carrega em < poucos segundos (warm)
- [ ] Providers: `market_provider_status` atualizado após cron
- [ ] Cookies `finsight_access` / `finsight_refresh` / `finsight_csrf`
- [ ] Sessão: refresh após expirar access
- [ ] JWT: logout/revoke invalida uso
- [ ] CSP sem quebrar charts/fonts (console limpo)
- [ ] Performance: Lighthouse mobile (baseline)
- [ ] LGPD: export JSON válido
- [ ] Disaster smoke: anotar RTO mental ([disaster-recovery.md](./disaster-recovery.md))
- [ ] Desabilitar Deployment Protection se bloqueando usuários
- [ ] Comunicar URL + política de privacidade

---

# 14. Plano de Rollback

### A) Falha só de código / Function

1. Vercel → Deployments → **Redeploy** ou **Instant Rollback** da release anterior estável.
2. Validar `/live` e `/ready`.
3. **Atenção:** Instant Rollback **não atualiza** a definição dos Cron Jobs — se o cron mudou, ajuste `vercel.json` e redeploye ou desabilite o cron manualmente.

### B) Migration quebrou o banco

1. Pausar tráfego (Deployment Protection / manutenção).
2. Restore do dump/PITR Supabase ([backup-restore.md](./backup-restore.md)).
3. `npm run migrate` na versão de schema compatível.
4. Invalidar Redis (`FLUSHDB` no DB Upstash do app, com cuidado).
5. Redeploy da tag/commit anterior.
6. Smoke login + contagens SQL.

### C) Vazamento de secrets

1. Rotacionar `JWT_*` e `CRON_SECRET` na Vercel.
2. Redeploy.
3. Revogar sessões:

```sql
UPDATE sessoes_usuario
SET revoked_at = now(), status = 'revogada'
WHERE status = 'ativa';
```

4. Invalidar tokens Resend/BRAPI se aplicável.

### D) Supabase indisponível

1. Aguardar/failover do provedor.
2. Atualizar `DATABASE_URL` se endpoint mudar.
3. Redeploy não é sempre necessário (env update + novas invocações).

---

# 15. Custos Estimados (MVP)

Valores aproximados em USD/mês — planos free sujeitos a mudança.

| Serviço | Plano típico MVP | Custo estimado | Quando pagar |
|---------|------------------|----------------|--------------|
| **Vercel** | Hobby | **US$ 0** | Pro (~US$ 20) se precisar cron >1x/dia, logs longos, team, mais funções |
| **Supabase** | Free | **US$ 0** | Pro (~US$ 25) se DB >500MB, pausa de projeto, PITR, mais conexões |
| **Upstash Redis** | Free | **US$ 0** | Pay-as-you-go se estourar comandos/storage |
| **Resend** | Free | **US$ 0** (~3k e-mails/mês) | Pago se volume de verify/reset crescer |
| **Domínio** | Registro | **US$ 10–20/ano** | — |
| **BRAPI** | Free / token | **US$ 0–?** | Se watchlist crescer além do free |
| **Sentry** | Free tier | **US$ 0** | Team quando volume de erros subir |

**Total MVP inicial:** ~**US$ 0–2/mês** (+ domínio anual), viável no free tier com poucos usuários.

**Sinais para migrar a planos pagos**

- Cron mais de 1x/dia ou precisão minuto a minuto
- Cold starts / timeouts frequentes no sync
- Conexões Postgres esgotadas
- Redis rate-limit errors
- Necessidade de PITR / SLA / suporte
- > ~50–100 usuários ativos diários com dashboards pesados

---

# 16. Melhorias Futuras

### Curto prazo

- Redis obrigatório em prod (alertar se ausente)
- Sentry ativo com `@sentry/node` instalado
- Staging Preview na Vercel com DB separado
- Corrigir/validar purge de histórico (`market_history` vs nomes no job)
- Smoke E2E mínimo (login → home → movimentação)

### Médio prazo

- MFA
- Upload real (Cloudinary)
- Soft-delete consistente em todos os repositórios de leitura
- Continuar fatiando `frontend/js/core/app.js` (handlers de formulário / rotas restantes)
- Observabilidade de SLO (p95 BFF, taxa de erro cron)
- RLS Supabase como defesa em profundidade

### Longo prazo

- Multi-região / read replica
- Pro Vercel + cron horário de mercado
- Materialized views / warehouse de analytics
- App mobile / PWA
- Separar API e frontend em projetos Vercel se o monólito Function crescer demais

---

# 17. Go / No-Go

## Resposta objetiva

**GO CONDICIONAL para MVP** — desde que o checklist pré-deploy seja 100% cumprido.

### Se ainda for NÃO

Falta **operacional**, não só código:

1. Supabase com schema + `npm run migrate` aplicados
2. Variáveis de produção fortes (JWT, CRON, SSL)
3. Resend com domínio verificado
4. Upstash Redis
5. Smoke tests pós-deploy (`/ready`, auth, cron, LGPD)
6. `ALLOW_ADMIN_SEED` desligado

### Se SIM — cuidados obrigatórios

- Tratar o primeiro mês como **beta fechado** (poucos usuários).
- Monitorar Cron diariamente na 1ª semana.
- Backup/PITR testado uma vez.
- Não habilitar seed admin em produção contínua.
- Aceitar precisão do Hobby Cron (±59 min).
- Ter runbook de rollback aberto ([disaster-recovery.md](./disaster-recovery.md)).

---

# 18. Guia de Deploy Passo a Passo

### Fase A — Preparar o banco (Supabase)

1. Criar conta/projeto no Supabase.
2. Anotar senha do DB e região.
3. Em **Database → Connection strings**:
   - **Direct** (5432) → uso local/CI/migrate
   - **Transaction pooler** (6543) → uso Vercel
4. No PC (com `psql` e Node 20+):

```bash
export DATABASE_URL="postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres"
export DATABASE_SSL=true
psql "$DATABASE_URL" -f docs/database/schema.sql
npm ci
npm run migrate
```

5. (Opcional bootstrap admin)

```bash
ALLOW_ADMIN_SEED=true \
ADMIN_SEED_EMAIL=admin@seudominio.com \
ADMIN_SEED_PASSWORD='SenhaForte12!' \
npm run migrate
```

6. Confirmar:

```sql
SELECT id, applied_at FROM schema_migrations ORDER BY applied_at;
SELECT email, papel, status FROM usuarios LIMIT 5;
```

7. Desligar seed daí em diante (`ALLOW_ADMIN_SEED` não vai para a Vercel).

### Fase B — Redis (Upstash)

1. Criar database Redis.
2. Copiar `REDIS_URL` (`rediss://…`).
3. Preferir região próxima de `iad1`.

### Fase C — Resend

1. Criar API Key.
2. Verificar domínio (DNS SPF/DKIM).
3. Definir `EMAIL_FROM` com esse domínio.
4. Testar envio pelo dashboard Resend.

### Fase D — GitHub

1. Garantir que o código está em `main`.
2. Confirmar CI verde.
3. Não commitar `.env`.

### Fase E — Vercel

1. **Add New Project** → importar o repo.
2. Root: `/` — Node 20.
3. Colar Environment Variables (Production), usando **pooler** em `DATABASE_URL`.
4. Valores mínimos:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...@...pooler.supabase.com:6543/postgres
DATABASE_SSL=true
DB_POOL_MAX_SERVERLESS=2
REDIS_URL=rediss://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CRON_SECRET=...
CORS_ORIGIN=https://SEU_PROJETO.vercel.app
APP_PUBLIC_URL=https://SEU_PROJETO.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
CSRF_ENABLED=true
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=FinSight <noreply@seudominio.com>
REQUIRE_EMAIL_VERIFIED=true
PRIVACY_POLICY_VERSION=1.0
BRAPI_TOKEN=...
```

5. Deploy.
6. Em **Settings → Cron Jobs**, confirmar `/api/cron/market` `0 6 * * *`.
7. Abrir a URL do deploy.

### Fase F — Validação imediata

```bash
curl -s https://SEU_DOMINIO/live
curl -s https://SEU_DOMINIO/ready
curl -s -X POST https://SEU_DOMINIO/api/cron/market \
  -H "Authorization: Bearer $CRON_SECRET"
```

No browser:

1. Registrar usuário
2. Confirmar e-mail
3. Login
4. Onboarding / Home
5. Criar conta + movimentação
6. Abrir dashboards
7. Perfil → exportar dados LGPD
8. (Admin) painel admin

### Fase G — Domínio custom (opcional)

1. Vercel → Domains → adicionar.
2. Configurar DNS.
3. Atualizar `CORS_ORIGIN` e `APP_PUBLIC_URL`.
4. Redeploy.
5. Revalidar cookies e login.

### Fase H — Liberar usuários

1. Checklist pós-deploy 100%.
2. Publicar `privacy.html` / termos.
3. Liberar acesso (beta → geral).
4. Monitorar Cron + Sentry + Supabase metrics na 1ª semana.

---

## Bloco pronto de variáveis (Production)

Copie e preencha no painel da Vercel:

```env
NODE_ENV=production
DATABASE_URL=
DATABASE_SSL=true
DB_POOL_MAX_SERVERLESS=2
REDIS_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CRON_SECRET=
CORS_ORIGIN=https://SEU_DOMINIO
APP_PUBLIC_URL=https://SEU_DOMINIO
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
CSRF_ENABLED=true
EMAIL_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM=FinSight <noreply@seudominio.com>
REQUIRE_EMAIL_VERIFIED=true
PRIVACY_POLICY_VERSION=1.0
ALLOW_ADMIN_SEED=false
BRAPI_TOKEN=
SENTRY_DSN=
```

---

*Manual gerado a partir da auditoria de deploy do FinSight. Atualize este arquivo quando a infraestrutura ou as variáveis mudarem.*
