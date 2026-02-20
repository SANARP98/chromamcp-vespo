/**
 * mcp-runner.js
 *
 * Spawns the MCP server as a short-lived subprocess and sends a single
 * JSON-RPC tool call, returning the parsed result.
 *
 * Used by the Electron main process to run MCP tools for the UI
 * (e.g. list_collections, get_collection_info, batch_ingest).
 *
 * The subprocess is killed immediately after the tool response arrives.
 * For streaming / long-running operations this module is not used —
 * those are handled by a persistent child process in Phase 5.
 */

import { spawn } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { homedir } from 'os'

// ─── Resolve the MCP server entry point ──────────────────────────────────────

export function getMcpServerPath() {
  if (app.isPackaged) {
    // Bundled into app resources by electron-builder extraResources config
    return join(process.resourcesPath, 'mcp', 'index.js')
  }
  // Development: repo root is one level above desktop/
  return join(app.getAppPath(), '..', 'mcp', 'vespo-patched', 'index.js')
}

export function getDbPath() {
  return process.env.VESPO_DB_PATH || join(homedir(), '.vespo', 'lancedb')
}

// ─── Run a single MCP tool call ───────────────────────────────────────────────

export function runMcpTool(toolName, toolArgs = {}, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const serverPath = getMcpServerPath()
    const dbPath = getDbPath()

    const child = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        VESPO_DB_PATH: dbPath,
        DEBUG_MCP: 'false',
        ...extraEnv
      }
    })

    let buffer = ''
    let settled = false

    function settle(fn) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { child.kill() } catch {}
      fn()
    }

    // Parse newline-delimited JSON-RPC from stdout
    child.stdout.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const msg = JSON.parse(trimmed)
          if (msg.id === 2) {
            // This is our tool response
            settle(() => {
              if (msg.result?.isError) {
                reject(new Error(msg.result.content?.[0]?.text || 'Tool error'))
              } else if (msg.result?.content?.[0]?.text) {
                try {
                  resolve(JSON.parse(msg.result.content[0].text))
                } catch {
                  resolve(msg.result.content[0].text)
                }
              } else {
                resolve(msg.result)
              }
            })
          }
        } catch {}
      }
    })

    child.on('error', (err) => settle(() => reject(err)))
    child.on('close', (code) => {
      if (!settled) settle(() => reject(new Error(`MCP process exited with code ${code}`)))
    })

    // Send initialize then the tool call
    const init = JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'vespo-desktop', version: '1.0.0' }
      }
    })
    const call = JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: toolName, arguments: toolArgs }
    })

    child.stdin.write(init + '\n')
    child.stdin.write(call + '\n')

    // Safety timeout (60s for slow operations like ingest)
    const timer = setTimeout(() => {
      settle(() => reject(new Error(`Tool '${toolName}' timed out after 60s`)))
    }, 60_000)
  })
}
