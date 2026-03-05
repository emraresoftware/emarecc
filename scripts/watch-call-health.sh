#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SINCE="2m"
INTERVAL="10"
OUT_DIR="$ROOT_DIR/logs/live"
AGENT=""
SERVICES=(web backend asterisk)

usage() {
  cat <<'EOF'
Kullanım:
  scripts/watch-call-health.sh [--since 2m] [--interval 10] [--agent agent12] [--out-dir logs/live]

Ne yapar:
  - web/backend/asterisk canlı loglarını tek dosyada sürekli toplar (raw)
  - çağrıyla ilgili kritik satırları ayrı bir dosyaya (focus) çıkarır
  - belirli aralıkla DB aktif çağrı snapshot'ı alır
  - belirli aralıkla Asterisk aktif kanal snapshot'ı alır

Örnek:
  scripts/watch-call-health.sh --agent agent12
  scripts/watch-call-health.sh --since 10m --interval 5 --agent agent12
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since)
      shift
      [[ $# -gt 0 ]] || { echo "Hata: --since için değer gerekli" >&2; exit 1; }
      SINCE="$1"
      ;;
    --interval)
      shift
      [[ $# -gt 0 ]] || { echo "Hata: --interval için değer gerekli" >&2; exit 1; }
      INTERVAL="$1"
      ;;
    --agent)
      shift
      [[ $# -gt 0 ]] || { echo "Hata: --agent için değer gerekli" >&2; exit 1; }
      AGENT="$1"
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
      echo "Bilinmeyen argüman: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
RAW_LOG="$OUT_DIR/call-watch-$TS.raw.log"
FOCUS_LOG="$OUT_DIR/call-watch-$TS.focus.log"
SNAPSHOT_LOG="$OUT_DIR/call-watch-$TS.snapshot.log"

printf 'Call health watch başladı\n'
printf '  Klasör: %s\n' "$ROOT_DIR"
printf '  Servisler: %s\n' "${SERVICES[*]}"
printf '  Since: %s\n' "$SINCE"
printf '  Interval: %ss\n' "$INTERVAL"
printf '  Agent filtresi: %s\n' "${AGENT:-yok}"
printf '  Raw log: %s\n' "$RAW_LOG"
printf '  Focus log: %s\n' "$FOCUS_LOG"
printf '  Snapshot log: %s\n\n' "$SNAPSHOT_LOG"

LOG_PID=""
SNAP_PID=""

cleanup() {
  set +e
  [[ -n "$LOG_PID" ]] && kill "$LOG_PID" >/dev/null 2>&1 || true
  [[ -n "$SNAP_PID" ]] && kill "$SNAP_PID" >/dev/null 2>&1 || true
  echo
  echo "Call health watch durdu."
  echo "Raw: $RAW_LOG"
  echo "Focus: $FOCUS_LOG"
  echo "Snapshot: $SNAPSHOT_LOG"
}
trap cleanup INT TERM EXIT

(
  docker compose logs -f --timestamps --since "$SINCE" "${SERVICES[@]}" \
    | tee -a "$RAW_LOG" \
    | awk '
      BEGIN { IGNORECASE = 1 }
      /calls\/initiate|\/calls\/.*\/hangup|dis arama|fct normalize hedef|dial\(|called pjsip\/fct-trunk|nobody picked up|hangup\(|spawn extension|sip\/2\.0 [45][0-9][0-9]|originate|aktif bir çağrı var/ {
        print $0
        fflush()
      }
    ' \
    | tee -a "$FOCUS_LOG"
) &
LOG_PID=$!

(
  while true; do
    {
      echo "==== $(date '+%F %T') snapshot ===="
      if [[ -n "$AGENT" ]]; then
        docker compose exec -T db psql -U postgres -d callcenter_db -c \
          "select c.id,c.status,c.hangup_cause,c.started_at,c.destination_number,u.username,u.extension from calls c join users u on c.agent_id=u.id where u.username='${AGENT}' and c.status in ('initiating','ringing','connected') order by c.started_at desc nulls last limit 20;" || true
      else
        docker compose exec -T db psql -U postgres -d callcenter_db -c \
          "select c.id,c.status,c.hangup_cause,c.started_at,c.destination_number,u.username,u.extension from calls c join users u on c.agent_id=u.id where c.status in ('initiating','ringing','connected') order by c.started_at desc nulls last limit 20;" || true
      fi
      docker compose exec -T asterisk asterisk -rx "core show channels concise" || true
      echo
    } | tee -a "$SNAPSHOT_LOG"
    sleep "$INTERVAL"
  done
) &
SNAP_PID=$!

wait "$LOG_PID"
