#!/usr/bin/env bash
set -euo pipefail

# generate-local-certs.sh
# Creates local TLS certs for Asterisk (WSS) and optionally for frontend nginx/Vite.
# - Uses mkcert if available (preferred).
# - Falls back to openssl self-signed (browser will warn).

WORKDIR="$(cd "$(dirname "$0")/.." && pwd)"
KEYS_DIR="$WORKDIR/asterisk_config/keys"
mkdir -p "$KEYS_DIR"

# Default hosts (can export VITE_SIP_DOMAIN before running)
HOSTS=("localhost" "127.0.0.1" "192.168.1.20")
if [ -n "${VITE_SIP_DOMAIN:-}" ]; then
  HOSTS=("${VITE_SIP_DOMAIN}" "${HOSTS[@]}")
fi

echo "Generating certificates for: ${HOSTS[*]}"

if command -v mkcert >/dev/null 2>&1; then
  echo "mkcert found — using mkcert (trusted by system browsers)."
  # mkcert allows specifying output files
  CERT_FILE="$KEYS_DIR/asterisk.crt"
  KEY_FILE="$KEYS_DIR/asterisk.key"
  mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" "${HOSTS[@]}"
  chmod 640 "$KEY_FILE"
  echo "Created: $CERT_FILE and $KEY_FILE"
  echo "Note: mkcert installs a local CA into the system trust store."
else
  echo "mkcert not found — falling back to openssl (self-signed)."
  CERT_FILE="$KEYS_DIR/asterisk.crt"
  KEY_FILE="$KEYS_DIR/asterisk.key"
  SUBJECT="/CN=${HOSTS[0]}"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_FILE" -out "$CERT_FILE" -subj "$SUBJECT"
  chmod 640 "$KEY_FILE"
  echo "Created self-signed cert: $CERT_FILE and $KEY_FILE"
  echo "Browser will warn about untrusted certificate. Use mkcert for trusted dev certs."
fi

echo
echo "Next steps:"
echo " - Ensure docker-compose mounts './asterisk_config' into /etc/asterisk (already configured)."
echo " - Restart asterisk container: docker compose restart asterisk"
echo " - Check asterisk logs: docker compose logs -f asterisk"
echo " - If using frontend dev server, add certs to Vite/Nginx as needed (see docs/SETUP_GUIDE.md)."
