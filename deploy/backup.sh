#!/bin/sh
# Daily PostgreSQL backup — runs inside the db_backup container
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/crm_${TIMESTAMP}.sql.gz"
KEEP_DAYS=7

echo "[backup] Starting backup at $TIMESTAMP"

pg_dump \
  -h "$POSTGRES_HOST" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-password \
  | gzip > "$BACKUP_FILE"

echo "[backup] Backup written to $BACKUP_FILE ($(du -sh $BACKUP_FILE | cut -f1))"

# Prune old backups
find /backups -name "crm_*.sql.gz" -mtime +${KEEP_DAYS} -delete
echo "[backup] Old backups pruned (kept last ${KEEP_DAYS} days)"
