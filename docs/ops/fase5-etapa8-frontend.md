# FASE 5 — Etapa 8: Frontend / perceived performance

## Objetivo

Reduzir requests ate a 1a pintura util, preservar consistencia pos-mutacao e isolamento por usuario.

## Auditoria

| Area | Estado |
|---|---|
| SWR in-memory (`bffCache`, TTL 60s / hard 300s) | OK |
| Home slim + secondary async | OK (1a pintura sem secondary) |
| Dashboard `?section=` | OK |
| Skeleton quando sem cache | OK |
| **Bug:** `reloadAndRender` nao limpava `bffCache` | Stale ate 60s pos-mutacao |
| **Duplicata:** perfil `getContext` apos insights BFF | Evitavel quando personalization vem no BFF |
| **Duplicata:** `users/me` no bootstrap se `currentUser` ja existe | Evitavel |
| Inflight paralelo mesmo key | Sem dedupe |

Logout faz `location.reload()` — isolamento OK.

## Alteracoes

1. `invalidateBffCache()` em toda `reloadAndRender` (mutacoes).
2. Dedupe inflight por cache key (`fetchAndApply`, `home-secondary`).
3. Personalization aplicada em metas/perfil a partir do insights BFF.
4. Removido `getContext` previo ao save do perfil (reload invalida + refetch).
5. Bootstrap reutiliza `store.currentUser` quando ja autenticado.

## Preservado

- TTL / soft refresh SWR
- Secondary fora da 1a pintura
- Sem framework novo
- Sem mudanca de contrato API
