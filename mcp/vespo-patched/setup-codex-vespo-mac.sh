#!/bin/bash
# ChromaDB MCP Server - One-liner installer for macOS/Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/SANARP98/chromamcp-vespo/main/mcp/vespo-patched/setup-codex-vespo-mac.sh | bash

set -e

REPO_BASE="https://raw.githubusercontent.com/SANARP98/chromamcp-vespo/main/mcp/vespo-patched"
SCRIPT_URL="${REPO_BASE}/setup-codex-vespo.js"

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required. Install it from https://nodejs.org" >&2
  exit 1
fi

# Download setup script to temp file (.mjs for ES module support)
TEMP_SCRIPT="$(mktemp /tmp/setup-codex-vespo-XXXXX.mjs)"
trap 'rm -f "$TEMP_SCRIPT"' EXIT

echo "Downloading ChromaDB MCP Server setup..."
curl -fsSL "$SCRIPT_URL" -o "$TEMP_SCRIPT"

# Run the setup
exec node "$TEMP_SCRIPT"
