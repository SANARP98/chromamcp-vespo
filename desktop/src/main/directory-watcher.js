/**
 * directory-watcher.js
 *
 * Manages persistent fs.watch instances for tracked directories.
 * When new files are created inside a watched directory, they are
 * automatically ingested via the MCP `ingest_file` tool.
 *
 * Watchers live for the lifetime of the Electron process — they are
 * restored from settings on every startup.
 */

import { watch, statSync } from 'fs'
import { join, basename, extname } from 'path'
import { runMcpTool } from './mcp-runner'

// ─── File type filter ─────────────────────────────────────────────────────────

const SUPPORTED_EXT = new Set([
  // Code
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.php', '.swift', '.kt', '.scala', '.rs', '.go',
  '.java', '.cs', '.cpp', '.c', '.h', '.m',
  // Config / data
  '.json', '.yaml', '.yml', '.toml', '.env', '.tf', '.hcl',
  '.csv', '.xml', '.sql',
  // Docs
  '.md', '.mdx', '.txt', '.rst', '.pdf',
  // Web
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  // Images (metadata only)
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
])

const IGNORED_PATH_PATTERNS = [
  /node_modules/,
  /[/\\]\./, // hidden files/dirs
  /\.lance$/,
  /\.git[/\\]/,
  /__pycache__/,
  /\.pyc$/,
]

function shouldProcess(filePath) {
  if (IGNORED_PATH_PATTERNS.some(rx => rx.test(filePath))) return false
  const ext = extname(filePath).toLowerCase()
  return SUPPORTED_EXT.has(ext)
}

// ─── In-memory watcher registry ──────────────────────────────────────────────

const registry = new Map() // dirPath → WatcherState

/**
 * Start watching a directory. Fires `onEvent(level, message)` for activity.
 * Returns { success, error? }.
 */
export function startWatching(dirPath, { collection, openaiApiKey = '' }, onEvent) {
  if (registry.has(dirPath)) {
    return { success: false, error: 'Already watching this directory' }
  }

  const state = {
    fsWatcher: null,
    collection,
    startedAt: new Date().toISOString(),
    filesIngested: 0,
    lastIngest: null,
    pendingFiles: new Set(),
    debounceTimer: null,
  }

  // Debounced batch processor — ingests queued files after 2 s of quiet
  async function flush() {
    state.debounceTimer = null
    const files = [...state.pendingFiles]
    state.pendingFiles.clear()
    for (const filePath of files) {
      onEvent('info', `Auto-ingesting: ${basename(filePath)}`)
      try {
        await runMcpTool('ingest_file', { path: filePath, collection }, {
          OPENAI_API_KEY: openaiApiKey,
        })
        state.filesIngested++
        state.lastIngest = new Date().toISOString()
        onEvent('success', `Ingested: ${basename(filePath)} → ${collection}`)
      } catch (e) {
        onEvent('error', `Ingest failed: ${basename(filePath)}: ${e.message}`)
      }
    }
  }

  let fsWatcher
  try {
    fsWatcher = watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return
      const fullPath = join(dirPath, filename)
      if (!shouldProcess(fullPath)) return
      // Verify the file actually exists (rename events fire for deletes too)
      try {
        const st = statSync(fullPath)
        if (!st.isFile()) return
      } catch {
        return // deleted — ignore
      }
      state.pendingFiles.add(fullPath)
      clearTimeout(state.debounceTimer)
      state.debounceTimer = setTimeout(flush, 2000)
    })
  } catch (e) {
    return { success: false, error: `Cannot watch directory: ${e.message}` }
  }

  fsWatcher.on('error', (err) => {
    onEvent('error', `Watcher error [${basename(dirPath)}]: ${err.message}`)
  })

  state.fsWatcher = fsWatcher
  registry.set(dirPath, state)
  onEvent('info', `Watching: ${dirPath} → collection "${collection}"`)
  return { success: true }
}

/**
 * Stop watching a directory.
 * Returns true if it was being watched, false otherwise.
 */
export function stopWatching(dirPath) {
  const state = registry.get(dirPath)
  if (!state) return false
  clearTimeout(state.debounceTimer)
  try { state.fsWatcher.close() } catch {}
  registry.delete(dirPath)
  return true
}

/** Is a path currently being watched? */
export function isWatching(dirPath) {
  return registry.has(dirPath)
}

/** Live stats for all active watchers. */
export function getWatcherStats() {
  return [...registry.entries()].map(([path, s]) => ({
    path,
    collection: s.collection,
    startedAt: s.startedAt,
    filesIngested: s.filesIngested,
    lastIngest: s.lastIngest,
    active: true,
  }))
}

/** Stop all active watchers (called on app quit). */
export function stopAllWatchers() {
  for (const [dirPath] of registry) stopWatching(dirPath)
}

/**
 * Derive a safe collection name from a directory path.
 * e.g. "/home/user/My Project" → "my_project"
 */
export function collectionNameFromPath(dirPath) {
  return basename(dirPath)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'tracked'
}
