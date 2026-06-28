#!/usr/bin/env bash
set -Eeuo pipefail

expo_mode="web"
dry_run="false"
start_tunnel="true"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expo-mode)
      expo_mode="${2:-}"
      shift 2
      ;;
    --lan)
      expo_mode="lan"
      shift
      ;;
    --web)
      expo_mode="web"
      shift
      ;;
    --dry-run)
      dry_run="true"
      shift
      ;;
    --no-ngrok)
      start_tunnel="false"
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: scripts/start-dev-linux.sh [--expo-mode web|lan|tunnel] [--no-ngrok] [--dry-run]

Starts UniMatch development services on Linux:
  - OCR worker on port 8788
  - auth callback server on port 8789
  - ngrok tunnel for the OCR worker, unless --no-ngrok is set
  - Expo on port 8081, or through an Expo tunnel when --expo-mode tunnel is used
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$expo_mode" != "web" && "$expo_mode" != "lan" && "$expo_mode" != "tunnel" ]]; then
  echo "Invalid --expo-mode value: $expo_mode. Use web, lan or tunnel." >&2
  exit 1
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ocr_worker="$root/ocr-worker"
npm_cache="$root/.npm-cache"
auth_callback_port="${AUTH_CALLBACK_PORT:-8789}"
pids=()

log() {
  printf '\n[%s] %s\n' "$1" "$2"
}

cleanup() {
  if [[ ${#pids[@]} -gt 0 ]]; then
    printf '\nStopping UniMatch development services...\n'
    for pid in "${pids[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done
  fi
}

trap cleanup EXIT INT TERM

start_service() {
  local title="$1"
  shift

  log "$title" "$*"
  if [[ "$dry_run" == "true" ]]; then
    return
  fi

  (
    set -Eeuo pipefail
    "$@"
  ) &
  pids+=("$!")
  sleep 2
}

ensure_ocr_dependencies() {
  if [[ ! -d "$ocr_worker/node_modules" ]]; then
    log "OCR deps" "Installing ocr-worker dependencies"
    if [[ "$dry_run" == "true" ]]; then
      return
    fi
    (cd "$ocr_worker" && NPM_CONFIG_CACHE="$npm_cache" npm install --no-audit --no-fund)
  fi
}

get_lan_ip() {
  local ip_address=""

  if command -v ip >/dev/null 2>&1; then
    ip_address="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
  fi

  if [[ -z "$ip_address" ]] && command -v hostname >/dev/null 2>&1; then
    ip_address="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  printf '%s' "$ip_address"
}

read_env_value() {
  local key="$1"
  local file="$root/.env"

  if [[ ! -f "$file" ]]; then
    return
  fi

  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file"
}

configure_auth_redirect_url() {
  local lan_ip
  lan_ip="$(get_lan_ip)"

  if [[ -n "$lan_ip" ]]; then
    export UNIMATCH_AUTH_CALLBACK_HOST="$lan_ip"
    export AUTH_CALLBACK_PORT="$auth_callback_port"
    export EXPO_PUBLIC_AUTH_REDIRECT_URL="http://$lan_ip:$auth_callback_port/auth-callback.html"
    log "Auth redirect" "Using Pi LAN URL: $EXPO_PUBLIC_AUTH_REDIRECT_URL"
    return
  fi

  local configured_url
  configured_url="$(read_env_value EXPO_PUBLIC_AUTH_REDIRECT_URL || true)"

  if [[ -n "$configured_url" ]]; then
    export AUTH_CALLBACK_PORT="$auth_callback_port"
    export EXPO_PUBLIC_AUTH_REDIRECT_URL="$configured_url"
    log "Auth redirect" "Could not detect LAN IP. Using .env URL: $EXPO_PUBLIC_AUTH_REDIRECT_URL"
    return
  fi

  echo "Could not detect the Pi LAN IP and EXPO_PUBLIC_AUTH_REDIRECT_URL is missing in .env." >&2
  exit 1
}

print_expo_lan_qr() {
  if [[ "$expo_mode" != "lan" || "$dry_run" == "true" ]]; then
    return
  fi

  local lan_ip
  lan_ip="$(get_lan_ip)"

  if [[ -z "$lan_ip" ]]; then
    echo "Could not detect LAN IP for Expo QR. Use the QR printed by Expo above."
    return
  fi

  local expo_url="exp://$lan_ip:8081"

  sleep 8
  cat <<EOF

Scan this QR with Expo Go:
$expo_url

EOF
  node -e 'const qr = require("qrcode-terminal"); qr.generate(process.argv[1], { small: false });' "$expo_url"
}

start_ngrok() {
  if [[ "$start_tunnel" != "true" ]]; then
    log "ngrok" "Skipped. Supabase Cloud cannot reach the local OCR worker without a public LEGI_OCR_SERVICE_URL."
    return
  fi

  local local_ngrok="$root/.tools/ngrok/ngrok"
  local auth_token_command="npx ngrok authtoken YOUR_NGROK_AUTHTOKEN"
  local ngrok_start_command=(env NPM_CONFIG_CACHE="$npm_cache" npx ngrok http 8788 --log stdout --log-format logfmt)

  if [[ -x "$local_ngrok" ]]; then
    auth_token_command="$local_ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN"
    ngrok_start_command=("$local_ngrok" http 8788 --log stdout --log-format logfmt)
  elif command -v ngrok >/dev/null 2>&1; then
    if ngrok config --help >/dev/null 2>&1; then
      auth_token_command="ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN"
    else
      auth_token_command="ngrok authtoken YOUR_NGROK_AUTHTOKEN"
    fi
    ngrok_start_command=(ngrok http 8788 --log stdout --log-format logfmt)
  fi

  cat <<EOF

ngrok requires a free account auth token before it can start a tunnel.
If this step fails with ERR_NGROK_4018, run once:

  $auth_token_command

Get the token from: https://dashboard.ngrok.com/get-started/your-authtoken
To start everything except ngrok, run: npm run dev:all:linux -- --no-ngrok
EOF

  start_service "ngrok" "${ngrok_start_command[@]}"
}

if [[ ! -f "$root/.env" ]]; then
  echo "Missing .env. Copy .env.example to .env and fill in the Supabase values first." >&2
  exit 1
fi

echo ""
echo "Starting UniMatch development services..."
echo ""

ensure_ocr_dependencies
configure_auth_redirect_url

start_service "OCR worker" env PORT=8788 NPM_CONFIG_CACHE="$npm_cache" npm --prefix "$ocr_worker" start
start_service "Auth callback page" node "$root/scripts/auth-callback-server.js"
start_ngrok

if [[ "$start_tunnel" == "true" ]]; then
  cat <<'EOF'

Services are running. Keep this terminal open.

Important:
1. Copy the https://... forwarding URL from the ngrok output.
2. Set it in Supabase as LEGI_OCR_SERVICE_URL.
3. If review-legi changed, deploy it with: npx supabase functions deploy review-legi
4. For iPhone/Android in the same Wi-Fi, run: npm run dev:all:linux:lan
5. For iPhone/Android from another network, run: npm run dev:all:linux:tunnel
6. Email confirmation page runs on the Auth redirect URL printed above.

Press Ctrl+C to stop all services.
EOF
else
  cat <<'EOF'

Services are running. Keep this terminal open.

Important:
1. ngrok was skipped, so Supabase Cloud cannot call the local OCR worker.
2. Use LEGI_REVIEW_MODE=demo or set LEGI_OCR_SERVICE_URL to a deployed/public OCR worker.
3. For iPhone/Android in the same Wi-Fi, run: npm run dev:all:linux:lan
4. For iPhone/Android from another network, run: npm run dev:all:linux:tunnel
5. Email confirmation page runs on the Auth redirect URL printed above.

Press Ctrl+C to stop all services.
EOF
fi

case "$expo_mode" in
  lan)
    start_service "Expo" env NPM_CONFIG_CACHE="$npm_cache" EXPO_NO_TELEMETRY=1 npx expo start --host lan --port 8081 --clear
    ;;
  tunnel)
    start_service "Expo tunnel" env NPM_CONFIG_CACHE="$npm_cache" EXPO_NO_TELEMETRY=1 npx expo start --tunnel --port 8081 --clear
    ;;
  web)
    start_service "Expo" env NPM_CONFIG_CACHE="$npm_cache" EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081 --clear
    ;;
esac

if [[ "$dry_run" == "true" ]]; then
  echo ""
  echo "Dry run complete. No services were started."
  exit 0
fi

print_expo_lan_qr

wait
