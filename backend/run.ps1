param(
    [string]$Host = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

$pythonCmd = $venvPython
$pythonArgs = @()

if (-not (Test-Path $venvPython)) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonCmd = "py"
        $pythonArgs += "-3"
    } else {
        $pythonCmd = "python"
    }
}

$pythonArgs += @(
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    $Host,
    "--port",
    $Port
)

if (-not $NoReload) {
    $pythonArgs += "--reload"
}

Set-Location $projectRoot
& $pythonCmd @pythonArgs
exit $LASTEXITCODE
