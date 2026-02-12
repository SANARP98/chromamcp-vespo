& {
    # ChromaDB MCP Server - One-liner uninstaller for Windows
    # Usage: irm https://raw.githubusercontent.com/SANARP98/chromamcp-vespo/main/mcp/vespo-patched/uninstall-codex-vespo.ps1 | iex

    $ErrorActionPreference = "Stop"

    $RepoBase = "https://raw.githubusercontent.com/SANARP98/chromamcp-vespo/main/mcp/vespo-patched"
    $ScriptUrl = "$RepoBase/uninstall-codex-vespo.js"

    # Check for Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: Node.js is required. Install it from https://nodejs.org" -ForegroundColor Red
        return
    }

    # Download uninstall script to temp file (.mjs for ES module support)
    $TempScript = Join-Path $env:TEMP "uninstall-codex-vespo.mjs"

    try {
        Write-Host "Downloading ChromaDB MCP Server uninstaller..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $ScriptUrl -OutFile $TempScript -UseBasicParsing
        & node $TempScript
    } finally {
        Remove-Item $TempScript -ErrorAction SilentlyContinue
    }
}
