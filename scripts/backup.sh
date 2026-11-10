#!/bin/sh
# Nightly backup of the database and uploaded images from the production compose stack.
# Usage: scripts/backup.sh [backup-dir]   (default ./backups; keeps the newest 14 of each)
# On the Watchtower stack: COMPOSE="docker compose -f deploy/docker-compose.yml" scripts/backup.sh
set -eu
DIR="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml}"
mkdir -p "$DIR"

$COMPOSE exec -T db pg_dump -U games -d games | gzip > "$DIR/db-$STAMP.sql.gz"
$COMPOSE exec -T app tar -C /data -czf - . > "$DIR/images-$STAMP.tar.gz"

for prefix in db images; do
  ls -1t "$DIR"/"$prefix"-* 2>/dev/null | tail -n +15 | while read -r old; do rm -f "$old"; done
done
echo "Backup written to $DIR ($STAMP)"
