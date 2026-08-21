# FASE 5 — Etapa 7: Request path

## Caminho auditado

```
HTTP → Vercel → Express
  → helmet/cors/rateLimit
  → compression
  → [morgan — removido em serverless]
  → json/cookies
  → requestLogger
  → bootstrapMiddleware
  → authenticate (GET: skip DB user se JWT completo; touch throttled)
  → csrf (no-op em GET)
  → BFF handler → service → repo → PG → res.json
```

## Achados

| Item | Evidencia | Acao |
|---|---|---|
| morgan + requestLogger | log duplicado em todo request | **morgan off em serverless** |
| `JSON.stringify` no monitor so para bytes | custo em todo BFF MISS; bytes nao iam em header | **removido** |
| `accounts.validator`/zod no load de `bff.routes` | zod ~57 ms LOCAL no require de /home | **lazy** so em detail |
| CSRF em GET | ja early-return | manter |
| Auth GET skip DB | ja implementado | manter |
| SQL | FASE 4 <2 ms no banco | **nao mexer** |
| Home slim + secondary | 1a pintura via `/home`; secondary async | OK (Etapa 8) |
| `perfil` + `getContext` extra | frontend | adiar Etapa 8 |

## O que NAO foi feito

- Remover rate limit / helmet / csrf
- Mudar SQL
- Mudar contratos BFF
