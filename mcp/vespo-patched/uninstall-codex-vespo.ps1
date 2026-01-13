# Wrapper for the uninstall script (Windows/PowerShell).

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UninstallScript = Join-Path $ScriptDir "uninstall-codex-vespo.js"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "node is required to run $UninstallScript"
    exit 1
}

& node $UninstallScript
exit $LASTEXITCODE
