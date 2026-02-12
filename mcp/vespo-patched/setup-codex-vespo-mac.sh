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

# Clean up any leftover temp files from previous broken runs
rm -f /tmp/setup-codex-vespo-XXXXX.mjs
rm -rf /tmp/setup-codex-vespo-*

# Download setup script to temp file (.mjs for ES module support)
TEMP_DIR="$(mktemp -d /tmp/setup-codex-vespo-XXXXX)"
TEMP_SCRIPT="${TEMP_DIR}/setup-codex-vespo.mjs"
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "Downloading ChromaDB MCP Server setup..."
curl -fsSL "$SCRIPT_URL" -o "$TEMP_SCRIPT"

# Run the setup — redirect stdin from /dev/tty so interactive prompts work
# even when this script is piped via curl | bash
exec node "$TEMP_SCRIPT" </dev/tty
