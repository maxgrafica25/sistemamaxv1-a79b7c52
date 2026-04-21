#!/bin/sh
# =============================================================================
# init-buckets.sh — cria buckets MinIO equivalentes aos do Lovable Cloud
# =============================================================================
# Executado uma vez após o MinIO subir. Idempotente — pode rodar várias vezes.
# =============================================================================
set -e

MINIO_HOST="${MINIO_HOST:-http://minio:9000}"
MINIO_USER="${MINIO_ROOT_USER:?MINIO_ROOT_USER não definido}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD não definido}"

echo "[init-buckets] aguardando MinIO em $MINIO_HOST..."
until mc alias set local "$MINIO_HOST" "$MINIO_USER" "$MINIO_PASS" >/dev/null 2>&1; do
  sleep 2
done
echo "[init-buckets] MinIO OK."

for bucket in chat-attachments maintenance-attachments storage; do
  if mc ls "local/$bucket" >/dev/null 2>&1; then
    echo "[init-buckets] bucket '$bucket' já existe."
  else
    echo "[init-buckets] criando bucket '$bucket'..."
    mc mb "local/$bucket"
  fi

  # chat-attachments e maintenance-attachments são públicos no Lovable Cloud
  if [ "$bucket" != "storage" ]; then
    mc anonymous set download "local/$bucket"
    echo "[init-buckets] '$bucket' marcado como público (download)."
  fi
done

echo "[init-buckets] concluído."
