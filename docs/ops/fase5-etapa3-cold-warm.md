# FASE 5 — Etapa 3: Cold vs Warm

## Metodologia

```bash
npm run measure:cold-warm
npm run measure:cold-warm:idle   # --idle-sec 420
```

| Classe | Criterio |
|---|---|
| COLD | `X-BFF-Warm=0` (isolate ainda nao completou BFF) |
| WARM+MISS | `Warm=1` + `Cache=MISS` |
| WARM+HIT | `Warm=1` + `Cache=HIT` |
| overheadMs | ESTIMADO = wallMs − X-BFF-Duration-Ms |

Sinais: Function init (warm=0 + uptime baixo), bootstrap (overhead 1a req), DB (`/ready` dbMs), SQL (headers), BFF (duration), serialize, rede (overhead).

**Nao** tratar request lenta como cold sem `Warm=0` / uptime baixo / idle.

Deteccao (commit `63006b2`): `servedOnce` no processo — nao apenas `uptime >= 5`.

## Resultados MEDIDOS (producao, 2026-08-21)

### Burst (instancia ja aquecida)

| Endpoint | wall p50 | wall p95 | server MISS | server HIT | SQL# MISS | overhead ~ |
|---|---:|---:|---:|---:|---:|---:|
| home | 78 | 111 | 34 | ~0.1 | 4 | 65–78 |
| home-secondary | 74 | 126 | 55 | ~0.1 | 10 | 65–74 |
| dashboard | 94 | 167 | 68 | ~0.2 | 17 | 80–99 |
| insights | 75 | 75 | 10 | ~0.1 | 2 | 65–75 |
| accounts | 78 | 89 | 17 | ~0.1 | 6 | 71–78 |
| transactions | 77 | 90 | 16 | ~0.1 | 5 | 70–77 |
| investments | 83 | 91 | 22 | ~0.1 | 6 | 69–83 |

Cold nesta fase: **0** (`warm=1` em todas).

### Apos idle 420s (MEDIDO)

| Sinal | Valor |
|---|---|
| `/ready` 1a wall | **1047 ms** |
| `/ready` 1a dbMs | 46 ms |
| `/ready` 2a wall | 88 ms (dbMs 5) |
| `/api/home` 1a | warm=**0**, uptime=**0.8s**, wall=126, server=37, cache=MISS |
| `/api/home` 2a | warm=1, wall=61, server=0.1, cache=HIT |

## Interpretacao

| Afirmacao | Tipo |
|---|---|
| Cold de plataforma (~1s) aparece em `/ready` apos idle; SQL/DB so ~46 ms | MEDIDO |
| Quase todo o 1047 ms e fora da query (bootstrap + cold Function + rede) | ESTIMADO (1047−46) |
| 1o BFF apos cold: server ~37 ms (~igual warm MISS); wall ~126 ms | MEDIDO |
| Em warm HIT, wall ~60–90 ms com server ~0.1 ms → rede/edge domina | MEDIDO |
| SQL soma pode > duration (queries em paralelo) | MEDIDO / conhecido |
| Gargalo dominante warm HIT = RTT cliente↔Vercel, nao SQL | HIPOTESE forte |
| Import pesado no cold (argon2 etc.) | NÃO MEDIDO (Etapa 4) |

## Artefatos

- `scripts/measure-cold-warm.mjs`
- `backend/src/modules/bff/monitoring/bff.monitor.js`
