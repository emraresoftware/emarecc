#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://localhost:3783"
PASSWORD="admin123"
CONCURRENCY=10
DO_CALLS=0
DESTINATION=""
OUT_DIR="logs/load-tests"
TIMEOUT=15

usage() {
  cat <<'EOF'
Kullanım:
  scripts/load-test-auth-calls.sh [opsiyonlar]

Opsiyonlar:
  --base-url URL          Varsayılan: https://localhost:3783
  --password PASS         Varsayılan: admin123
  --concurrency N         Varsayılan: 10
  --calls                 Login sonrası /calls/initiate de test et
  --destination NUM       --calls ile zorunlu (örn: 1000 veya 905551234567)
  --out-dir DIR           Varsayılan: logs/load-tests
  --timeout SEC           Varsayılan: 15
  -h, --help              Yardım

Notlar:
  - Varsayılan kullanıcı seti: agent_test01..20 + lider_test01..05
  - TLS self-signed için curl -k kullanılır.

Örnekler:
  scripts/load-test-auth-calls.sh
  scripts/load-test-auth-calls.sh --concurrency 20
  scripts/load-test-auth-calls.sh --calls --destination 1000 --concurrency 10
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      shift; BASE_URL="${1:-}" ;;
    --password)
      shift; PASSWORD="${1:-}" ;;
    --concurrency)
      shift; CONCURRENCY="${1:-}" ;;
    --calls)
      DO_CALLS=1 ;;
    --destination)
      shift; DESTINATION="${1:-}" ;;
    --out-dir)
      shift; OUT_DIR="${1:-}" ;;
    --timeout)
      shift; TIMEOUT="${1:-}" ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Bilinmeyen parametre: $1" >&2
      usage
      exit 1 ;;
  esac
  shift
done

if [[ "$DO_CALLS" -eq 1 && -z "$DESTINATION" ]]; then
  echo "Hata: --calls ile birlikte --destination vermelisiniz." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Hata: jq gerekli (brew install jq)." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
RESULT_FILE="$OUT_DIR/load-test-$TS.csv"
SUMMARY_FILE="$OUT_DIR/load-test-$TS.summary.txt"

USERS=()
for i in $(seq 1 20); do USERS+=("agent_test$(printf '%02d' "$i")"); done
for i in $(seq 1 5); do USERS+=("lider_test$(printf '%02d' "$i")"); done

printf 'user,login_ok,login_code,call_ok,call_code,extension,error\n' > "$RESULT_FILE"

export BASE_URL PASSWORD DO_CALLS DESTINATION TIMEOUT RESULT_FILE

run_one() {
  local user="$1"
  local login_body login_code token extension call_code call_ok error
  login_body="$(mktemp)"
  call_ok="NA"
  call_code="NA"
  extension=""
  error=""

  login_code="$(curl -k -sS --max-time "$TIMEOUT" -o "$login_body" -w '%{http_code}' \
    -X POST "$BASE_URL/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$user\",\"password\":\"$PASSWORD\"}" || true)"

  if [[ "$login_code" == "200" ]]; then
    token="$(jq -r '.access_token // empty' "$login_body" 2>/dev/null || true)"
    if [[ -z "$token" ]]; then
      printf '%s,false,%s,%s,%s,%s,%s\n' "$user" "$login_code" "$call_ok" "$call_code" "$extension" "token_missing" >> "$RESULT_FILE"
      rm -f "$login_body"
      return 0
    fi

    if [[ "$DO_CALLS" -eq 1 ]]; then
      local me_body call_body
      me_body="$(mktemp)"
      call_body="$(mktemp)"

      curl -k -sS --max-time "$TIMEOUT" -o "$me_body" \
        -H "Authorization: Bearer $token" \
        "$BASE_URL/api/v1/auth/me" || true

      extension="$(jq -r '.extension // empty' "$me_body" 2>/dev/null || true)"
      if [[ -z "$extension" ]]; then
        call_ok="false"
        call_code="000"
        error="extension_missing"
      else
        call_code="$(curl -k -sS --max-time "$TIMEOUT" -o "$call_body" -w '%{http_code}' \
          -X POST "$BASE_URL/api/v1/calls/initiate" \
          -H 'Content-Type: application/json' \
          -H "Authorization: Bearer $token" \
          -d "{\"extension\":\"$extension\",\"destination\":\"$DESTINATION\"}" || true)"

        if [[ "$call_code" =~ ^20[01]$ ]]; then
          call_ok="true"
        else
          call_ok="false"
          error="$(jq -r '.message // empty' "$call_body" 2>/dev/null || true)"
          [[ -z "$error" ]] && error="call_failed"
        fi
      fi

      rm -f "$me_body" "$call_body"
    fi

    printf '%s,true,%s,%s,%s,%s,%s\n' "$user" "$login_code" "$call_ok" "$call_code" "$extension" "$error" >> "$RESULT_FILE"
  else
    error="$(jq -r '.message // empty' "$login_body" 2>/dev/null || true)"
    [[ -z "$error" ]] && error="login_failed"
    printf '%s,false,%s,%s,%s,%s,%s\n' "$user" "$login_code" "$call_ok" "$call_code" "$extension" "$error" >> "$RESULT_FILE"
  fi

  rm -f "$login_body"
}

export -f run_one

printf 'Load test başlıyor: users=%s concurrency=%s calls=%s\n' "${#USERS[@]}" "$CONCURRENCY" "$DO_CALLS"

printf '%s\n' "${USERS[@]}" | xargs -I{} -P "$CONCURRENCY" bash -lc 'run_one "$@"' _ {}

LOGIN_PASS="$(awk -F',' 'NR>1 && $2=="true" {c++} END{print c+0}' "$RESULT_FILE")"
LOGIN_FAIL="$(awk -F',' 'NR>1 && $2=="false" {c++} END{print c+0}' "$RESULT_FILE")"

{
  echo "Load Test Özeti"
  echo "================="
  echo "Base URL: $BASE_URL"
  echo "Users: ${#USERS[@]}"
  echo "Concurrency: $CONCURRENCY"
  echo "Login PASS: $LOGIN_PASS"
  echo "Login FAIL: $LOGIN_FAIL"

  if [[ "$DO_CALLS" -eq 1 ]]; then
    CALL_PASS="$(awk -F',' 'NR>1 && $4=="true" {c++} END{print c+0}' "$RESULT_FILE")"
    CALL_FAIL="$(awk -F',' 'NR>1 && $4=="false" {c++} END{print c+0}' "$RESULT_FILE")"
    echo "Call PASS: $CALL_PASS"
    echo "Call FAIL: $CALL_FAIL"
    echo "Destination: $DESTINATION"
  fi

  echo
  echo "Detay CSV: $RESULT_FILE"
} | tee "$SUMMARY_FILE"

echo "Özet dosyası: $SUMMARY_FILE"
