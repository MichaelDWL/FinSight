# FASE 5 — Etapa 6: Postgres connection path

## Objetivo

Decompor quanto dos ~800–1000 ms de `/ready` cold e:

- DNS / TCP / TLS+auth / query / reuso

**Sem** aumentar `pool max`, **sem** trocar infra, **sem** servico pago.

## Instrumentacao

`/ready` passa a expor (apos deploy):

- `responseTimeMs` — total
- `acquireMs` — `pool.connect()` (nova conexao se frio)
- `queryMs` — `SELECT NOW()...` apos acquire

Script local: `npm run measure:db-path`

## MEDIDO — LOCAL → pooler Supabase `:6543` (sa-east-1)

| Fase | ms |
|---|---:|
| DNS | 17 |
| TCP | 45 |
| Client.connect (TCP+SSLRequest+TLS+auth) | **212** |
| TLS+auth+startup (ESTIMADO = connect − TCP) | **167** |
| Query em client aberto | ~30–35 |
| Pool 1a acquire | **212** |
| Pool warm acquire | **~0.2** |
| Pool warm query | ~31–35 |

Raw `tls.connect` na porta PG **falha** (`WRONG_VERSION_NUMBER`) — esperado (protocolo SSLRequest).

## MEDIDO — LOCAL → direct `:5432` (comparativo)

| Fase | Pooler :6543 | Direct :5432 |
|---|---:|---:|
| Client.connect | **212** | **326** |
| Pool 1a acquire | 212 | 245 |
| Pool warm query | ~35 | ~30 |

Direct **nao** e mais barato no connect; no serverless Free o pooler continua correto.

| seq | responseTimeMs |
|---:|---:|
| 1 (cold-ish) | **1673** |
| 2 | 5.4 |
| 3 | 5.0 |
| 4 | 5.2 |

## Interpretacao

| Afirmacao | Tipo |
|---|---|
| Reuso de pool e barato (~0.2 ms acquire local; ~5 ms `/ready` warm Vercel) | MEDIDO |
| 1a conexao ao pooler local ~212 ms (dominada por TLS+auth, nao pela query) | MEDIDO |
| Query SQL em si ~30–35 ms LOCAL → pooler (RTT), nao o gargalo do cold `/ready` 1s+ | MEDIDO |
| Cold `/ready` Vercel ~1.6 s >> connect local ~0.2 s | MEDIDO |
| Diferenca ~1.4 s = cold Function + bootstrap + RTT gru1↔sa-east-1 | ESTIMADO / HIPOTESE |
| Pooler `:6543` e a escolha correta no Free Tier | HIPOTESE forte (ja em uso; evita esgotar conexoes) |
| Trocar para direct `:5432` | NÃO recomendado serverless Free (limites de conexao) |

## O que NAO foi alterado

- `DB_POOL_MAX_SERVERLESS=2`
- Host/porta do banco
- Redis / novos servicos
- Regras de negocio

## Conclusao da etapa

Nao ha otimizacao gratuita segura que elimine o custo de 1a conexao TLS+RTT Vercel↔Supabase.

Manter: pool pequeno + pooler + singleton `globalThis` + keepAlive.

Proximos ganhos relevantes estao fora deste path (cold JS ja tratado na Etapa 5; perceived performance no frontend = Etapa 8).
