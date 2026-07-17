# Query plans — consultas criticas (FinSight)

Documentacao de estrategias de indice e plano esperado.
Rodar em staging: `EXPLAIN (ANALYZE, BUFFERS) <sql>`.

## 1. Listagem de movimentacoes (paginada)

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.id, m.descricao, m.tipo, m.valor, m.data_transacao, m.status
  FROM movimentacoes m
 WHERE m.usuario_id = $1
   AND m.excluido_em IS NULL
 ORDER BY m.data_transacao DESC, m.created_at DESC
 LIMIT 50 OFFSET 0;
```

**Indice esperado:** `idx_movimentacoes_usuario_ativas_data` (parcial `excluido_em IS NULL`).
**Meta:** Index Scan / Index Only Scan; sem Seq Scan em usuarios com >10k linhas.

## 2. Atualizacao de saldo (FOR UPDATE)

```sql
BEGIN;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM contas WHERE id = $1 FOR UPDATE;
UPDATE contas SET saldo_atual = saldo_atual + $2, versao = versao + 1 WHERE id = $1;
COMMIT;
```

**Meta:** Row lock pontual; latencia tipica < 5ms sob carga baixa.

## 3. BFF Home / summary financeiro

Agregacoes em `dashboard.repository` / analytics CTE usam:
- `idx_movimentacoes_usuario_tipo_status_data`
- `idx_mov_analytics_period`
- `idx_faturas_usuario_mes`

**Meta:** CTE unica por painel; evitar N+1 de categorias.

## 4. Idempotency lookup

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT status_code, response_body
  FROM idempotency_keys
 WHERE usuario_id = $1 AND chave = $2;
```

**Indice:** `uq_idempotency_user_key` (UNIQUE).

## Checklist pos-migrate

1. `npm run migrate`
2. `ANALYZE movimentacoes; ANALYZE contas;`
3. Rodar os EXPLAIN acima
4. Anexar planos reais em PR de performance se p99 > 200ms.
