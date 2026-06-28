param(
  [ValidateSet("web", "lan")]
  [string]$ExpoMode = "web",
  [switch]$NoNgrok,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$ocrWorker = Join-Path $root "ocr-worker"
$npmCache = Join-Path $root ".npm-cache"
$authCallbackScript = Join-Path $root "scripts\auth-callback-server.js"
$globalNgrok = Get-Command "ngrok" -ErrorAction SilentlyContinue
$ngrokCommand = if ($globalNgrok) { "ngrok http 8788" } else { "npx.cmd ngrok http 8788" }
if ($globalNgrok) {
  $ngrokSupportsConfig = $false
  try {
    & ngrok config --help *> $null
    $ngrokSupportsConfig = $LASTEXITCODE -eq 0
  } catch {
    $ngrokSupportsConfig = $false
  }
  $ngrokAuthCommand = if ($ngrokSupportsConfig) { "ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN" } else { "ngrok authtoken YOUR_NGROK_AUTHTOKEN" }
} else {
  $ngrokAuthCommand = "npx.cmd ngrok authtoken YOUR_NGROK_AUTHTOKEN"
}
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
  -Title "Auth callback page" `
  -Command "cd `"$root`"; node `"$authCallbackScript`""

Start-Sleep -Seconds 2

if ($NoNgrok) {
  Write-Host "[ngrok] Skipped. Supabase Cloud cannot reach the local OCR worker without a public LEGI_OCR_SERVICE_URL." -ForegroundColor Yellow
} else {
  Write-Host ""
  Write-Host "ngrok requires a free account auth token before it can start a tunnel." -ForegroundColor Yellow
  Write-Host "If this step fails with ERR_NGROK_4018, run once:"
  Write-Host "  $ngrokAuthCommand"
  Write-Host "Get the token from: https://dashboard.ngrok.com/get-started/your-authtoken"
  Write-Host "To start everything except ngrok, run: .\scripts\start-dev.ps1 -NoNgrok"
  Write-Host ""

  Start-DevWindow `
    -Title "ngrok" `
    -Command $ngrokCommand
}

Start-Sleep -Seconds 2

Start-DevWindow `
  -Title "Expo" `
  -Command "cd `"$root`"; `$env:NPM_CONFIG_CACHE=`"$npmCache`"; `$env:NODE_TLS_REJECT_UNAUTHORIZED='0'; `$env:EXPO_NO_TELEMETRY='1'; $expoCommand"

if ($DryRun) {
  Write-Host "Dry run complete. No windows were opened." -ForegroundColor Green
} elseif ($NoNgrok) {
  Write-Host "Opened OCR worker and Expo in separate PowerShell windows. ngrok was skipped." -ForegroundColor Green
} else {
  Write-Host "Opened OCR worker, ngrok and Expo in separate PowerShell windows." -ForegroundColor Green
}
Write-Host ""
Write-Host "Important:" -ForegroundColor Yellow
if ($NoNgrok) {
  Write-Host "1. ngrok was skipped, so Supabase Cloud cannot call the local OCR worker."
  Write-Host "2. Use LEGI_REVIEW_MODE=demo or set LEGI_OCR_SERVICE_URL to a deployed/public OCR worker."
  Write-Host "3. For iPhone/Android through Expo Go, run: .\scripts\start-dev.ps1 -ExpoMode lan -NoNgrok"
  Write-Host "4. Email confirmation page runs on http://localhost:8789/auth-callback.html"
} else {
  Write-Host "1. Copy the https://...ngrok-free.app forwarding URL from the ngrok window."
  Write-Host "2. Set it in Supabase as LEGI_OCR_SERVICE_URL."
  Write-Host "3. If review-legi changed, deploy it with: npx.cmd supabase functions deploy review-legi"
  Write-Host "4. For iPhone/Android through Expo Go, run: .\scripts\start-dev.ps1 -ExpoMode lan"
  Write-Host "5. Email confirmation page runs on http://localhost:8789/auth-callback.html"
}
Write-Host ""
