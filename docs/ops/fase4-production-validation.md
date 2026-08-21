# FASE 4 — Validacao de producao (evidencias)

## TLS

- CA: `backend/certs/supabase-root-2021-ca.crt` (Supabase Root 2021, publica)
- Handshake validado (MEDIDO):
  - direto `:5432` → ok
  - pooler `:6543` → ok
- Locais atualizados: `DATABASE_SSL_INSECURE=false` + `DATABASE_SSL_CA_FILE`
- **Acao humana na Vercel:** copiar as mesmas vars e redeploy (ate la prod pode continuar com insecure do deploy antigo)

## Volume real (Supabase, MEDIDO)

| Tabela | Rows |
|---|---|
| market_history | 813 |
| movimentacoes | 35 |
| historico_saude_financeira | 12 |
| regras_orcamento | 10 |
| metas | 8 |
| usuarios | 7 |
| investimentos | 6 |
| contas | 5 |
| demais | ≤3 |

Indices existentes nas tabelas criticas: **68** (movimentacoes ja possui dezenas).

## EXPLAIN (Supabase, MEDIDO)

Queries criticas executam em **< 2 ms**. Seq Scan aparece por volume minimo — esperado.
**Nenhum indice adicional justificado.**

## BFF producao (MEDIDO, 5 samples)

Base: `https://finsight-mdwl.vercel.app`

| Endpoint | p50 (HIT) | p95 (incl. MISS) | Nota |
|---|---|---|---|
| home | ~0.1 ms | ~4063 ms | 1o MISS frio |
| home/secondary | — | — | **404** (rota nao no deploy atual) |
| dashboard | ~0.2 ms | ~2134 ms | |
| dashboard?section=general | ~0.17 ms | ~0.18 ms | so HIT |
| insights | ~0.07 ms | ~1501 ms | |
| accounts | ~0.06 ms | ~574 ms | |
| transactions | ~0.06 ms | ~459 ms | |
| investments | ~0.11 ms | ~581 ms | |

`X-BFF-SQL-Count` veio 0 no deploy atual — instrumentacao SQL pode estar desatualizada na Vercel; duracoes sao confiaveis.

DB `/ready` em prod: ~1021 ms (latencia rede Function↔Postgres).

## Conclusao operacional

Gargalo dominante em MISS frio = **cold start + RTT Vercel(gru1)↔Supabase(sa-east-1)**, nao scans de tabela.
Crescimento Free Tier: indices atuais bastam ate volumes bem maiores.
