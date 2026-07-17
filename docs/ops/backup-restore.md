# Backup e Restore — FinSight (PostgreSQL)

## Principios

1. Backup e responsabilidade do provedor gerenciado (Neon/Supabase) no MVP Vercel.
2. Em Docker/VPS, use `pg_dump` periodico + armazenamento offsite.
3. Nunca faça restore em producao sem janela de manutencao e validacao de integridade.

## Backup logico (pg_dump)

```bash
# Dump completo (custom format — comprimido)
pg_dump "$DATABASE_URL" -Fc -f "finsight-$(date +%Y%m%d-%H%M).dump"

# Dump SQL plain (legivel)
pg_dump "$DATABASE_URL" -f "finsight-$(date +%Y%m%d).sql"
```

No Windows (PowerShell):

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
pg_dump $env:DATABASE_URL -Fc -f "finsight-$stamp.dump"
```

## Restore

```bash
# Custom format
pg_restore --clean --if-exists -d "$DATABASE_URL" finsight-YYYYMMDD.dump

# Plain SQL
psql "$DATABASE_URL" -f finsight-YYYYMMDD.sql
```

Apos restore, rode:

```bash
npm run migrate
```

## Frequencia recomendada (MVP)

| Ambiente | Frequencia | Retencao |
|----------|------------|----------|
| Producao (managed) | Point-in-time do provedor | 7–30 dias |
| Docker/VPS | Diario as 03:00 | 14 dumps |
| Pre-deploy | Dump manual | 3 versoes |

## O que NAO entra no backup de aplicacao

- Secrets (`.env`) — use vault / Vercel Env
- Cache Redis — descartavel
- Arquivos de upload locais — use Cloudinary

## Validacao pos-restore

1. `GET /ready` → 200
2. Login admin / usuario de teste
3. Contagem: `SELECT COUNT(*) FROM usuarios; SELECT COUNT(*) FROM movimentacoes;`
4. Conferir ultima migration: `SELECT * FROM schema_migrations ORDER BY applied_at;`
