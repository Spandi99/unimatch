param(
  [ValidateSet("web", "lan")]
  [string]$ExpoMode = "web",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$ocrWorker = Join-Path $root "ocr-worker"
$npmCache = Join-Path $root ".npm-cache"
$ngrokCommand = if (Get-Command "ngrok" -ErrorAction SilentlyContinue) { "ngrok http 8788" } else { "npx.cmd ngrok http 8788" }
$expoCommand = if ($ExpoMode -eq "lan") { "npx.cmd expo start --host lan --port 8081 --clear" } else { "npx.cmd expo start --web --port 8081 --clear" }

Write-Host ""
Write-Host "Starting UniMatch development services..." -ForegroundColor Cyan
Write-Host ""

function Start-DevWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  Write-Host "[$Title] $Command" -ForegroundColor DarkGray
  if ($DryRun) { return }

  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $Command
  )
}

Start-DevWindow `
  -Title "OCR worker" `
  -Command "cd `"$ocrWorker`"; `$env:NPM_CONFIG_CACHE=`"$npmCache`"; `$env:NPM_CONFIG_STRICT_SSL='false'; if (-not (Test-Path node_modules)) { npm.cmd install --no-audit --no-fund }; npm.cmd start"

Start-Sleep -Seconds 2

Start-DevWindow `
  -Title "ngrok" `
  -Command $ngrokCommand

Start-Sleep -Seconds 2

Start-DevWindow `
  -Title "Expo" `
  -Command "cd `"$root`"; `$env:NPM_CONFIG_CACHE=`"$npmCache`"; `$env:NODE_TLS_REJECT_UNAUTHORIZED='0'; `$env:EXPO_NO_TELEMETRY='1'; $expoCommand"

if ($DryRun) {
  Write-Host "Dry run complete. No windows were opened." -ForegroundColor Green
} else {
  Write-Host "Opened OCR worker, ngrok and Expo in separate PowerShell windows." -ForegroundColor Green
}
Write-Host ""
Write-Host "Important:" -ForegroundColor Yellow
Write-Host "1. Copy the https://...ngrok-free.app forwarding URL from the ngrok window."
Write-Host "2. Set it in Supabase as LEGI_OCR_SERVICE_URL."
Write-Host "3. If review-legi changed, deploy it with: npx.cmd supabase functions deploy review-legi"
Write-Host "4. For iPhone/Android through Expo Go, run: .\scripts\start-dev.ps1 -ExpoMode lan"
Write-Host ""
