$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$ocrWorker = Join-Path $root "ocr-worker"

Write-Host ""
Write-Host "Starting UniMatch development services..." -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command "ngrok" -ErrorAction SilentlyContinue)) {
  Write-Host "ngrok was not found in PATH. Install/sign in to ngrok first, then run this script again." -ForegroundColor Yellow
  Write-Host "Manual ngrok command: ngrok http 8788"
  exit 1
}

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd `"$ocrWorker`"; if (-not (Test-Path node_modules)) { npm.cmd install }; npm.cmd start"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "ngrok http 8788"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd `"$root`"; `$env:NODE_TLS_REJECT_UNAUTHORIZED='0'; `$env:EXPO_NO_TELEMETRY='1'; npx.cmd expo start --web --port 8081 --clear"
)

Write-Host "Opened OCR worker, ngrok and Expo in separate PowerShell windows." -ForegroundColor Green
Write-Host ""
Write-Host "Important:" -ForegroundColor Yellow
Write-Host "1. Copy the https://...ngrok-free.app forwarding URL from the ngrok window."
Write-Host "2. Set it in Supabase as LEGI_OCR_SERVICE_URL."
Write-Host "3. If review-legi changed, deploy it with: npx.cmd supabase functions deploy review-legi"
Write-Host ""
