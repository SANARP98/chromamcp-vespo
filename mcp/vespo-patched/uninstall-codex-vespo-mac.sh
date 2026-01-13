#!/bin/bash
# Wrapper for the uninstall script (macOS/Linux).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNINSTALL_SCRIPT="${SCRIPT_DIR}/uninstall-codex-vespo.js"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required to run ${UNINSTALL_SCRIPT}" >&2
  exit 1
fi

exec node "${UNINSTALL_SCRIPT}"
