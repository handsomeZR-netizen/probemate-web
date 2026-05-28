$ErrorActionPreference = "Stop"

$ApiDir = Resolve-Path (Join-Path $PSScriptRoot "..\api")
Push-Location $ApiDir
try {
  $env:AI_PROVIDER = "deepseek"
  if (-not $env:DEEPSEEK_MODEL -and -not $env:AI_MODEL) {
    $env:DEEPSEEK_MODEL = "deepseek-v4-flash"
  }
  if (-not $env:DEEPSEEK_API_KEY) {
    Write-Warning "DEEPSEEK_API_KEY is not set. The API will start, but real provider calls will fall back."
  }
  uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
} finally {
  Pop-Location
}
