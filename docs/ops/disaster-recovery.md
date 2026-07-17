# Disaster Recovery — FinSight

## RTO / RPO (MVP)

| Metrica | Alvo MVP |
|---------|----------|
| RTO (tempo ate voltar) | < 4 horas |
| RPO (perda maxima de dados) | < 24 horas (dump diario) ou PITR do provedor |

## Cenarios

### 1. Falha da Function / Vercel

- Sintoma: 5xx em `/api/*`, frontend carrega estatico.
- Acao: redeploy na Vercel; verificar logs; `/live` e `/ready`.
- Dados: intactos (Postgres externo).

### 2. Corrupcao / perda do banco

1. Pausar escrita (manutencao / scale-to-zero se aplicavel).
2. Restaurar ultimo dump ou PITR (Neon/Supabase).
3. `npm run migrate`
4. Validar `/ready` + smoke login.
5. Invalidar cache Redis (`FLUSHDB` no namespace se necessario).

### 3. Vazamento de secrets (JWT / CRON)

1. Rotacionar `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET` na Vercel.
2. Redeploy.
3. Todas as sessoes JWT antigas ficam invalidas (access) — forcar logout em massa via `UPDATE sessoes SET revoked_at = now()`.

### 4. Regiao / provedor Postgres indisponivel

- Failover do provedor (Neon branch / Supabase).
- Atualizar `DATABASE_URL` na Vercel.
- Redeploy ou aguardar cold start com nova URL.

## Runbook rapido

```text
1. Identificar: /live (processo) vs /ready (deps)
2. Se /live OK e /ready FAIL → banco ou Redis
3. Se ambos FAIL → plataforma (Vercel)
4. Comunicar usuarios (status page / email)
5. Restaurar → migrar → smoke → reabrir
```

## Testes de DR

- Trimestral: restore de dump em staging e smoke test.
- Documentar tempo real (atualiza RTO).

## Contatos / ownership

Definir no time: quem tem acesso Vercel, Neon/Supabase e Redis (Upstash).
