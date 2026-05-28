$ErrorActionPreference = "Stop"

$ApiDir = Resolve-Path (Join-Path $PSScriptRoot "..\api")
Push-Location $ApiDir
try {
  $env:AI_PROVIDER = "mock"
  if (-not $env:STORE_BACKEND) {
    $env:STORE_BACKEND = "json"
  }
  uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
} finally {
  Pop-Location
}
