#!/bin/sh
# Restauração do Pro Delphus+. Destrutivo: substitui o banco e os uploads atuais.
#
#   ./scripts/restore.sh backups/db-20260807-030000.sql.gz \
#                        backups/uploads-20260807-030000.tar.gz
#
# Use sempre o par do MESMO carimbo de tempo. Misturar um banco de hoje com
# uploads de semana passada produz orçamento apontando para PDF inexistente.
set -eu

DB_DUMP="${1:-}"
UPLOADS_TAR="${2:-}"

if [ -z "$DB_DUMP" ]; then
  echo "uso: $0 <db-*.sql.gz> [uploads-*.tar.gz]" >&2
  exit 1
fi

COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml --env-file .env.prod}"

# Carrega .env.prod no shell também — sem isso, POSTGRES_USER/POSTGRES_DB só
# chegam ao container via --env-file, e este script cairia nos defaults do
# .env.prod.example mesmo que você tenha customizado esses valores.
if [ -f .env.prod ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.prod
  set +a
fi

UPLOADS_VOLUME="${UPLOADS_VOLUME:-prodelphusplus_uploads_data}"

printf 'Isto APAGA o banco e os arquivos atuais. Digite "restaurar" para seguir: '
read -r answer
[ "$answer" = "restaurar" ] || { echo "cancelado"; exit 1; }

echo "→ parando api e web (o banco fica de pé para receber o dump)"
$COMPOSE stop api web

echo "→ recriando o schema"
$COMPOSE exec -T postgres psql -U "${POSTGRES_USER:-prodelphus}" -d "${POSTGRES_DB:-prodelphusplus}" \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

echo "→ restaurando o banco"
gunzip -c "$DB_DUMP" | $COMPOSE exec -T postgres psql -U "${POSTGRES_USER:-prodelphus}" -d "${POSTGRES_DB:-prodelphusplus}"

if [ -n "$UPLOADS_TAR" ]; then
  echo "→ restaurando os uploads"
  # A extração roda como root dentro do container alpine — sem o chown, os
  # arquivos ficam donos de root e a API (processo `node`, uid/gid 1000)
  # não consegue nem escrever um PDF novo ali (EACCES na primeira geração
  # de orçamento depois da restauração).
  docker run --rm -v "$UPLOADS_VOLUME":/target -v "$(cd "$(dirname "$UPLOADS_TAR")" && pwd)":/src alpine \
    sh -c "rm -rf /target/* && tar -xzf /src/$(basename "$UPLOADS_TAR") -C /target && chown -R 1000:1000 /target"
fi

echo "→ subindo api e web"
$COMPOSE up -d api web

echo "pronto. Confira o histórico de orçamentos e abra um PDF antigo para validar."
