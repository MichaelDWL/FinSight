# FASE 5 — ETAPA 10 — Auditoria final

Data: 2026-08-21  
Commits relevantes: `9e0d797` … `64c9176` (+ docs)

## Criterios de sucesso

| Criterio | Status |
|---|---|
| TLS validado na Vercel (`rejectUnauthorized=true`, `caProvided=true`) | OK |
| `/api/home/secondary` em producao | OK (200) |
| Deploy atualizado | OK |
| Cold vs warm separados | OK (Etapa 3) |
| Bootstrap auditado | OK (Etapa 4) |
| Conexao Postgres medida | OK (Etapa 6) |
| BFFs com benchmark real | OK |
| Sem N+1 conhecido novo | OK |
| Sem indice especulativo | OK |
| GETs read-only / recorrencias fora do GET | OK |
| Testes 100% | OK (**123/123**) |
| Sem servico pago / Redis | OK |
| Sem segredo exposto | OK |

---

## Comparativo FASE 4 → FASE 5

Valores **server-side** `X-BFF-Duration-Ms` quando disponivel; wall = cliente.

| Endpoint | Fase 4 p50 | Fase 4 p95 | Fase 5 p50 | Fase 5 p95 | SQL (MISS) | Observacao |
|---|---:|---:|---:|---:|---:|---|
| `/ready` DB | — | ~800–1021 | ~5–50 warm | ~1047 cold wall | — | Cold = Function+RTT; query ~5–46 ms |
| `/api/home` | — | ~4063 | ~78 wall / ~34 srv MISS | ~111 wall | 4 | Secondary separado; HIT srv ~0.1 |
| `/api/home/secondary` | — | **404** | ~74 wall / ~55 srv | ~126 wall | 10 | **Corrigido no deploy** |
| `/api/dashboard` | — | ~2134 | ~94 wall / ~68 srv | ~167 wall | 17 | `?section=` HIT ~0.2 srv |
| `/api/insights` | — | ~1501 | ~75 wall / ~10 srv | ~75 wall | 2 | |
| `/api/accounts` | — | ~574 | ~78 wall / ~17 srv | ~89 wall | 6 | |
| `/api/transactions` | — | ~459 | ~77 wall / ~16 srv | ~90 wall | 5 | |
| `/api/investments` | — | ~581 | ~83 wall / ~22 srv | ~91 wall | 6 | |

Fontes:

- **Fase 4 p95:** baseline producao documentada (deploy antigo; cold+RTT misturados).
- **Fase 5:** Etapa 3 burst warm (MISS→HIT) em producao pos-deploy TLS+codigo novo.

**MEDIDO adicional**

- TLS prod: `rejectUnauthorized=true`, `caProvided=true`, `caSource=file`
- `/ready` warm: `acquireMs`~43, `queryMs`~2.6 (amostra)
- Cold apos idle 420s: `/ready` wall **1047 ms**, dbMs **46**; home `warm=0` wall 126 / server 37
- Stress conc=6: **0 erros**; pool max=2 mantido
- Require LOCAL `app.js`: 454 → **330 ms** (−27%) apos Etapa 5

---

## Dimensoes

| Dimensao | Fase 4 | Fase 5 |
|---|---|---|
| Cold start | Inferido | Separado (flag + idle) |
| Warm request | Misturado | HIT ~0.1 ms server; wall ~70–90 ms rede |
| DB RTT | ~800–1000 ms em /ready | Decomposto; query ~30–46 ms; connect local pooler ~212 ms |
| TLS | Inseguro / deploy antigo | CA validada em prod |
| Bootstrap | Nao ranqueado | Auditado + lazy argon2/routers/BFF |
| SQL | Ja <2 ms no banco | Sem indices novos |
| Payload | — | Sem stringify extra no monitor |
| Cache | BFF memory | + coalesce inflight; frontend invalida pos-mutacao |
| Testes | 99 | **123** |

---

## Respostas objetivas

### 1. Qual e o gargalo dominante?

**MEDIDO / HIPOTESE forte:** em warm HIT, o wall (~70–90 ms) e quase todo **RTT cliente↔Vercel (gru1)**; server BFF ~0.1 ms.  
Em cold `/ready`, ~1 s e **cold start da Function + bootstrap + 1a conexao**, nao SQL (dbMs ~46).

### 2. Quanto dele conseguimos reduzir?

- Deploy + secondary + TLS fechados (bloqueadores).
- Cold JS LOCAL require −27%; lazy path de GET BFF.
- MISS warm home wall ~111 ms vs p95 Fase 4 ~4 s (misturava cold/deploy antigo) — **nao comparavel 1:1**, mas ordem de grandeza melhor em warm.
- **Nao eliminamos** RTT Free Tier nem cold isolate ~1 s.

### 3. Quanto e inerente ao modelo Vercel + Supabase Free?

- Cold Function apos idle
- RTT gru1 ↔ sa-east-1 (~65–90 ms floor em HIT)
- Pool max baixo (2) + pooler
- Cache so por instancia (sem Redis)

### 4. Existe otimizacao adicional sem custo?

Possiveis (marginal):

- Mais lazy de validators/zod no auth path
- Afinar TTLs frontend
- Evitar `/ready` como wake desnecessario

**Sem ganho transformador** gratuito restante.

### 5. O que NAO vale a pena mexer?

- Indices especulativos (dataset minimo)
- Aumentar pool Free
- Redis/APM pago
- Trocar direct `:5432` (pior connect; pior para serverless)
- Reescrever SQL dos BFFs ja medidos

### 6. Existe risco para producao?

Baixo residual: lazy routers (1a hit do path paga require); cache memory por isolate; invalidacao frontend ampla pos-mutacao (correto).

### 7. O sistema esta pronto para usuarios reais?

**Sim**, para escala Free / early users: TLS ok, secondary ok, GETs read-only, stress 0 erros, testes 100%.  
Expectativa: 1a request apos idle pode levar ~1 s; navegacao warm e perceptivelmente rapida com SWR.

---

## Limite arquitetural (declaracao)

> O restante da latencia e consequencia da arquitetura **Vercel Free + Supabase Free + distancia de rede**. Nao existe otimizacao gratuita segura capaz de eliminar o floor de RTT nem o cold start do isolate. Inventar otimizacoes adicionais degradaria a arquitetura por milissegundos duvidosos.

FASE 5 **encerrada** neste limite.
