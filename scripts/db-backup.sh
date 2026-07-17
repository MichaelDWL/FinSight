#!/usr/bin/env bash
# Backup logico do Postgres FinSight
# Uso: DATABASE_URL=... ./scripts/db-backup.sh
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M)
OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/finsight-$STAMP.dump"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL obrigatorio" >&2
  exit 1
fi
pg_dump "$DATABASE_URL" -Fc -f "$OUT"
echo "Backup criado: $OUT"
