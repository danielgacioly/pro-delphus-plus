#!/bin/sh
# Backup do Pro Delphus+ — banco e arquivos, no mesmo instante.
#
# Os dois precisam andar juntos: o banco guarda a URL do PDF do orçamento e o
# arquivo em si vive no volume de uploads. Restaurar só um dos lados deixa
# registro apontando para arquivo que não existe.
#
# Roda como serviço no docker-compose.prod.yml, mas também funciona à mão:
#   PGHOST=localhost PGPORT=5433 PGUSER=prodelphus PGPASSWORD=... \
#   PGDATABASE=prodelphusplus BACKUP_DIR=./backups \
#   UPLOADS_PATH=apps/api/uploads ./scripts/backup.sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_PATH="${UPLOADS_PATH:-/data/uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

DB_FILE="$BACKUP_DIR/db-$STAMP.sql.gz"
UP_FILE="$BACKUP_DIR/uploads-$STAMP.tar.gz"

# Grava com sufixo .partial e só renomeia no fim: se o processo morrer no meio,
# sobra um arquivo obviamente incompleto em vez de um backup truncado que
# parece bom até a hora em que você precisa dele.
echo "[backup $STAMP] banco"
pg_dump --no-owner --no-privileges | gzip -9 > "$DB_FILE.partial"
mv "$DB_FILE.partial" "$DB_FILE"

echo "[backup $STAMP] uploads"
if [ -d "$UPLOADS_PATH" ]; then
  tar -czf "$UP_FILE.partial" -C "$UPLOADS_PATH" .
  mv "$UP_FILE.partial" "$UP_FILE"
else
  echo "[backup $STAMP] AVISO: $UPLOADS_PATH não existe — nenhum arquivo salvo"
fi

# Expurgo só depois do sucesso: se o backup de hoje falhou, os antigos ficam.
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name '*.partial' -mtime +1 -delete

DB_SIZE="$(du -h "$DB_FILE" | cut -f1)"
UP_SIZE="$([ -f "$UP_FILE" ] && du -h "$UP_FILE" | cut -f1 || echo '—')"
echo "[backup $STAMP] pronto — banco $DB_SIZE, uploads $UP_SIZE (retenção ${RETENTION_DAYS}d)"

# ATENÇÃO: isto é backup LOCAL. Se a máquina morrer, morre com ela.
# Mande $BACKUP_DIR para fora todo dia (rclone, aws s3 sync, rsync) — sem isso
# metade do problema continua de pé.
