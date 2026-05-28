$ErrorActionPreference = "Stop"

$ApiDir = Resolve-Path (Join-Path $PSScriptRoot "..\api")
Push-Location $ApiDir
try {
  $env:AI_PROVIDER = "openai"
  if (-not $env:OPENAI_API_KEY) {
    Write-Warning "OPENAI_API_KEY is not set. The API will start, but real provider calls will fall back."
  }
  if (-not $env:AI_MODEL) {
    Write-Warning "AI_MODEL is not set. OpenAI provider status will report unconfigured until a model is provided."
  }
  uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
} finally {
  Pop-Location
}
