/**
 * codex-config.js
 *
 * Reads and updates ~/.codex/config.toml so Codex CLI knows about the
 * Vespo MCP server. On every app start we ensure the entry is present
 * and points to the correct server path for this installation.
 *
 * String-based TOML manipulation (no parser library needed) mirrors the
 * approach used by the existing setup-codex-vespo.js scripts.
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { app } from 'electron'
import { getMcpServerPath } from './mcp-runner'

const CONFIG_PATH = join(homedir(), '.codex', 'config.toml')
const SERVER_NAME = 'chromadb_context_vespo'

// ─── Strip existing Vespo section from TOML string ───────────────────────────

function stripVespoSection(content) {
  const startMarker = `[mcp_servers.${SERVER_NAME}]`
  const idx = content.indexOf(startMarker)
  if (idx === -1) return content.trimEnd()

  // Find where the next top-level section starts (or end of file)
  const afterSection = content.slice(idx + startMarker.length)
  const nextSection = afterSection.search(/^\[(?!mcp_servers\.)/m)

  let stripped
  if (nextSection === -1) {
    // Vespo section goes to end of file
    stripped = content.slice(0, idx)
  } else {
    stripped = content.slice(0, idx) + afterSection.slice(nextSection)
  }

  // Also strip any comment lines immediately before the section
  return stripped.replace(/(?:^|\n)(# (?:Vespo|Patched vespo|Auto-configured)[^\n]*\n)+/g, '\n').trimEnd()
}

// ─── Build the new TOML section string ───────────────────────────────────────

function buildVespoSection(mcpPath) {
  // Forward-slash paths work on all platforms inside TOML strings
  const normalised = mcpPath.replace(/\\/g, '/')
  return [
    '',
    `# Vespo Desktop MCP server — auto-configured on ${new Date().toISOString()}`,
    `[mcp_servers.${SERVER_NAME}]`,
    `command = "node"`,
    `args = ["${normalised}"]`,
    `startup_timeout_sec = 60`,
    `tool_timeout_sec = 300`,
    `enabled = true`,
    ''
  ].join('\n')
}

// ─── Check whether config already has an up-to-date entry ───────────────────

function isUpToDate(content, mcpPath) {
  const normalised = mcpPath.replace(/\\/g, '/')
  return content.includes(`[mcp_servers.${SERVER_NAME}]`) &&
    content.includes(`"${normalised}"`)
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function checkAndUpdateCodexConfig() {
  const mcpPath = getMcpServerPath()

  // Ensure ~/.codex/ exists
  const codexDir = join(homedir(), '.codex')
  if (!existsSync(codexDir)) {
    await mkdir(codexDir, { recursive: true })
  }

  // Read existing config (may be empty / not exist yet)
  let existing = ''
  try {
    existing = await readFile(CONFIG_PATH, 'utf-8')
  } catch {
    // No config yet — we'll create one
  }

  // Nothing to do if the current path is already in config
  if (isUpToDate(existing, mcpPath)) {
    return { updated: false, message: 'Codex config already up-to-date' }
  }

  // Strip any old vespo entry and append fresh one
  const stripped = stripVespoSection(existing)
  const updated = stripped + buildVespoSection(mcpPath)

  await writeFile(CONFIG_PATH, updated, 'utf-8')

  return {
    updated: true,
    message: `Codex config updated → ${mcpPath}`
  }
}

export async function removeFromCodexConfig() {
  try {
    const existing = await readFile(CONFIG_PATH, 'utf-8')
    const stripped = stripVespoSection(existing)
    await writeFile(CONFIG_PATH, stripped, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

export async function readCodexConfigStatus() {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8')
    const configured = content.includes(`[mcp_servers.${SERVER_NAME}]`)
    const mcpPath = getMcpServerPath()
    const pathMatches = content.includes(mcpPath.replace(/\\/g, '/'))
    return { exists: true, configured, pathMatches }
  } catch {
    return { exists: false, configured: false, pathMatches: false }
  }
}
