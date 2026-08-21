# FASE 5 — Etapa 9: Stress / concorrencia

## Objetivo

Medir comportamento sob concorrencia com `pool max=2`. **Nao** aumentar o pool.

## Script

```bash
npm run measure:stress
# --concurrency 6 (default)
```

## MEDIDO — producao (concurrency=6)

| Cenario | ok | errors | wall p95 | caches |
|---|---:|---:|---:|---|
| same-user `/home` | 6 | **0** | 1279 | MISS |
| same-user `/home/secondary` | 6 | **0** | 258 | MISS |
| same-user `/dashboard` | 6 | **0** | 409 | MISS |
| same-user `/accounts` | 6 | **0** | 120 | MISS |
| same-user `/investments` | 6 | **0** | 166 | MISS |
| same-user mixed | 6 | **0** | 155 | HIT+MISS |
| two-users `/home` | 6 | **0** | 109 | HIT+MISS |

**Verdict:** `totalErrors=0`, pool max permanece 2.

## Interpretacao

| Afirmacao | Tipo |
|---|---|
| Sem 5xx/timeout sob 6 paralelos nos BFFs testados | MEDIDO |
| Isolates Vercel distintos explicam varios MISS simultaneos | HIPOTESE |
| ALS (sql.tracker / requestContext) nao vazou entre requests | HIPOTESE (sem erro de contagem cruzada observado) |
| Thundering herd no `CacheService.wrap` na mesma instancia | risco conhecido |

## Alteracao (com evidencia de risco)

`CacheService.wrap` agora **coalesce** MISS concorrentes na mesma key (`inflightWrap`).

- Nao aumenta pool
- Reduz N factories SQL na mesma Function
- Waiters marcam `cacheHit: true` (coalesced)

## O que NAO foi alterado

- `DB_POOL_MAX_SERVERLESS=2`
- Infraestrutura / Redis
