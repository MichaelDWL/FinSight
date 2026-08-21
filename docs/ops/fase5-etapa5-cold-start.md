# FASE 5 — Etapa 5: Reducao de cold start

## Justificativa (Etapa 4)

| Candidato | Evidencia | Acao |
|---|---|---|
| argon2 no module scope via csrf/crypto | LOCAL ~16 ms; desnecessario em GET | Lazy `require("argon2")` |
| `routes/index` eager | LOCAL ~420 ms | `mountLazy` CRUD/admin/market |
| bff.controller eager all services | puxa investments/reports no /home | `lazyFn` por endpoint |
| request-logger → ua-parser | so usava `ip` | `getClientIp` only |
| ua-parser em requestMeta | auth audit ainda precisa | Lazy no `parseDeviceInfo` |

## Antes × Depois (MEDIDO LOCAL — `measure-bootstrap.mjs`)

| Componente | Antes p50 | Depois p50 | Delta |
|---|---:|---:|---:|
| `app.js` | 454 ms | **330 ms** | −27% |
| `routes/index` | 420 ms | **294 ms** | −30% |
| `bff/routes` | 287 ms | **189 ms** | −34% |
| `utils/crypto` | 8 ms | **2 ms** | sem argon2 no require |
| `requestMeta` | 7 ms | **3 ms** | sem ua-parser no require |
| `csrf.middleware` | 19 ms | **12 ms** | |

**NAO e benchmark de producao.** Impacto Vercel: ESTIMADO parcial dos ~1000 ms de cold `/ready`.

## Comportamento

Inalterado funcionalmente: argon2 ainda em hash/verify; UA parser em `parseDeviceInfo` (auth); routers montam na 1a request do path; BFF services na 1a chamada do endpoint.

## Arquivos

- `backend/src/utils/crypto.js`
- `backend/src/utils/requestMeta.js`
- `backend/src/middlewares/request-logger.middleware.js`
- `backend/src/routes/index.js`
- `backend/src/modules/bff/bff.controller.js`
- `tests/unit/coldStartLazy.test.js`
