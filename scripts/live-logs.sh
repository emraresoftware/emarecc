#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SINCE="10m"
OUT_DIR="$ROOT_DIR/logs/live"
SERVICES=()

usage() {
  cat <<'EOF'
Kullanım:
  scripts/live-logs.sh [--since 5m] [--out-dir logs/live] [service1 service2 ...]

Örnekler:
  scripts/live-logs.sh
  scripts/live-logs.sh --since 30m
  scripts/live-logs.sh web backend asterisk
  scripts/live-logs.sh --since 1h --out-dir logs/live web backend

Açıklama:
  - Varsayılan servisler: web backend asterisk
  - Canlı takip eder ve aynı anda dosyaya yazar
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since)
      shift
      [[ $# -gt 0 ]] || { echo "Hata: --since için değer gerekli" >&2; exit 1; }
      SINCE="$1"
      ;;
    --out-dir)
      shift
      [[ $# -gt 0 ]] || { echo "Hata: --out-dir için değer gerekli" >&2; exit 1; }
      OUT_DIR="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      SERVICES+=("$1")
      ;;
  esac
  shift
done

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  SERVICES=(web backend asterisk)
fi

mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$OUT_DIR/live-$TS.log"

printf 'Canlı log takibi başladı\n'
printf '  Klasör: %s\n' "$ROOT_DIR"
printf '  Servisler: %s\n' "${SERVICES[*]}"
printf '  Since: %s\n' "$SINCE"
printf '  Kayıt dosyası: %s\n\n' "$LOG_FILE"

cleanup() {
  echo
  echo "Canlı takip sonlandırıldı. Log kaydı: $LOG_FILE"
}
trap cleanup INT TERM EXIT

docker compose logs -f --timestamps --since "$SINCE" "${SERVICES[@]}" | tee -a "$LOG_FILE"
