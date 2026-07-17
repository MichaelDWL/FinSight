# API — Rate Limit, Paginacao e Protecao contra abuso

## Rate Limit

Configuracao central: [`src/config/rateLimit.config.js`](../src/config/rateLimit.config.js)  
Servico: [`src/services/rateLimit/RateLimitService.js`](../src/services/rateLimit/RateLimitService.js)

### Armazenamento

| Ambiente | Store |
|----------|--------|
| Com `REDIS_URL` | Redis (compartilhado) |
| Desenvolvimento sem Redis | Memoria local |
| Producao sem Redis | Memoria + **log de erro** (ineficaz multi-instancia) |

### Limites (padrao)

| Grupo | Max | Janela | Chave |
|-------|-----|--------|-------|
| Global | 300 | 15 min | IP |
| Login | 5 | 1 min | IP |
| Registro | 3 | 1 min | IP |
| Reset senha | 3 | 15 min | IP |
| Refresh | 20 | 1 min | IP |
| Dashboard / Home / Insights | 100 | 1 min | Usuario+IP |
| BFF (geral) | 120 | 1 min | Usuario+IP |
| Movimentacoes | 60 | 1 min | Usuario+IP |
| Investimentos | 60 | 1 min | Usuario+IP |
| Contas / Cartoes | 60 | 1 min | Usuario+IP |
| Mercado | 30 | 1 min | Usuario+IP |
| Relatorios | 20 | 1 min | Usuario+IP |
| Admin | 30 | 1 min | Usuario+IP |
| Export LGPD | 2 | 1 hora | Usuario+IP |

### Headers de resposta

Em toda resposta sob rate limit:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (epoch seconds)
- `Retry-After` (segundos) — quando `429`

### Resposta 429

```json
{
  "success": false,
  "message": "Muitas requisicoes. Aguarde e tente novamente.",
  "code": "RATE_LIMIT_EXCEEDED",
  "data": {
    "group": "login",
    "retryAfterSec": 42,
    "limit": 5,
    "windowMs": 60000
  }
}
```

Eventos `429` sao logados com: IP, userId, endpoint, requestId, group, retryAfter.

---

## Paginacao

Configuracao: [`src/config/pagination.config.js`](../src/config/pagination.config.js)  
Servico: [`src/services/pagination/PaginationService.js`](../src/services/pagination/PaginationService.js)  
Middleware: `paginate({ resource })`

### Parametros

| Param | Default | Min | Max | Notas |
|-------|---------|-----|-----|-------|
| `page` | 1 | 1 | 100000 | |
| `pageSize` | 20 | 1 | 100 | Valores > 100 sao **clampados** para 100 |
| `sort` | depende do recurso | — | whitelist | Campo invalido → 400 |
| `order` | `desc` | — | `asc` \| `desc` | |

### Exemplo

```
GET /api/movements?page=1&pageSize=20&sort=date&order=desc&status=paga
```

### Resposta paginada

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "page": 1,
    "pageSize": 20,
    "total": 134,
    "totalPages": 7,
    "sort": "date",
    "order": "desc"
  }
}
```

### Endpoints com paginacao obrigatoria

- `GET /api/movements`
- `GET /api/movements/transactions`
- `GET /api/movements/bills`
- `GET /api/goals`
- `GET /api/investments/detailed`
- Admin users / audit (ja existente)

### Ordenacao segura (movements)

Permitido: `date`, `data`, `valor`, `value`, `created_at`, `descricao`, `nome`  
**Nunca** aceita coluna SQL arbitraria do cliente.

### Filtros seguros (SafeQueryBuilder)

Movements: `status`, `tipo`/`type`, `contaId`/`accountId`, `from`, `to`  
Apenas filtros cadastrados em `pagination.config.js` — sem concatenacao SQL.

---

## Boas praticas

1. Alterar limites **somente** em `src/config/rateLimit.config.js` e `pagination.config.js`.
2. Controllers leves: `req.pagination` via middleware.
3. Repositories usam `LIMIT`/`OFFSET` + `ORDER BY` whitelistado.
4. Redis obrigatorio em producao multi-instancia / Vercel.
