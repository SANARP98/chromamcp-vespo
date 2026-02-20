/**
 * ipc-handlers.js
 *
 * All IPC channels between the Electron main process and the renderer.
 * Channel convention: 'vespo:<action>'
 *
 * Collections are read by listing the LanceDB directory (~/.vespo/lancedb/).
 * Each collection is a sub-directory with a .lance suffix.
 * Counts come from a quick MCP tool call so we don't need a native module.
 */

import { ipcMain, dialog, shell } from 'electron'
import { readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { runMcpTool, listMcpTools, getDbPath, getMcpServerPath } from './mcp-runner'
import { checkAndUpdateCodexConfig, readCodexConfigStatus } from './codex-config'
import { getSettings, saveSettings } from './store'
import {
  startWatching,
  stopWatching,
  isWatching,
  getWatcherStats,
  collectionNameFromPath
} from './directory-watcher'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function listLanceCollections(dbPath) {
  if (!existsSync(dbPath)) return []
  try {
    const entries = await readdir(dbPath, { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory() && e.name.endsWith('.lance'))
      .map(e => e.name.slice(0, -6)) // strip .lance suffix
  } catch {
    return []
  }
}

async function getLanceCollectionSize(dbPath, name) {
  const tablePath = join(dbPath, `${name}.lance`)
  try {
    let total = 0
    const walk = async (dir) => {
      const items = await readdir(dir, { withFileTypes: true })
      for (const item of items) {
        const full = join(dir, item.name)
        if (item.isDirectory()) await walk(full)
        else { const s = await stat(full); total += s.size }
      }
    }
    await walk(tablePath)
    return total
  } catch {
    return 0
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function formatRelativeTime(isoString) {
  if (!isoString) return null
  const diff = Date.now() - new Date(isoString).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Register all handlers ────────────────────────────────────────────────────

export function registerIpcHandlers(_ipcMain, getWindow, emit) {

  // ── Status ────────────────────────────────────────────────────────────────
  ipcMain.handle('vespo:get-status', async () => {
    const dbPath = getDbPath()
    const codex = await readCodexConfigStatus()
    const settings = await getSettings()

    const collections = await listLanceCollections(dbPath)
    let totalSize = 0
    for (const name of collections) {
      totalSize += await getLanceCollectionSize(dbPath, name)
    }

    return {
      dbPath,
      dbExists: existsSync(dbPath),
      mcpServerPath: getMcpServerPath(),
      codexConfigured: codex.configured,
      codexPathMatches: codex.pathMatches,
      codexConfigExists: codex.exists,
      collectionCount: collections.length,
      totalSize: formatBytes(totalSize),
      settings
    }
  })

  // ── Collections ───────────────────────────────────────────────────────────
  ipcMain.handle('vespo:get-collections', async () => {
    const dbPath = getDbPath()
    const names = await listLanceCollections(dbPath)

    const collections = await Promise.all(names.map(async (name) => {
      const sizeBytes = await getLanceCollectionSize(dbPath, name)
      return { name, size: formatBytes(sizeBytes), sizeBytes }
    }))

    // Sort by size descending
    return collections.sort((a, b) => b.sizeBytes - a.sizeBytes)
  })

  // ── Get collection info (with doc count via MCP) ──────────────────────────
  ipcMain.handle('vespo:get-collection-info', async (_e, { collection }) => {
    try {
      const settings = await getSettings()
      const result = await runMcpTool('get_collection_info', { collection }, {
        OPENAI_API_KEY: settings.openaiApiKey || ''
      })
      return { success: true, ...result }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // ── Delete collection ─────────────────────────────────────────────────────
  ipcMain.handle('vespo:delete-collection', async (_e, { collection }) => {
    try {
      await runMcpTool('unload_collection', { collection })
      emit('success', `Deleted collection: ${collection}`)
      return { success: true }
    } catch (e) {
      emit('error', `Failed to delete ${collection}: ${e.message}`)
      return { success: false, error: e.message }
    }
  })

  // ── Scan directory ────────────────────────────────────────────────────────
  ipcMain.handle('vespo:scan-directory', async (_e, { path: dirPath }) => {
    try {
      const result = await runMcpTool('scan_directory', { path: dirPath, recursive: true })
      return { success: true, ...result }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // ── Run any MCP tool ──────────────────────────────────────────────────────
  ipcMain.handle('vespo:run-tool', async (_e, { tool, args }) => {
    try {
      emit('info', `Running: ${tool}…`)
      const settings = await getSettings()
      const result = await runMcpTool(tool, args, {
        OPENAI_API_KEY: settings.openaiApiKey || ''
      })
      emit('success', `Done: ${tool}`)
      return { success: true, result }
    } catch (e) {
      emit('error', `${tool} failed: ${e.message}`)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('vespo:list-tools', async () => {
    try {
      const tools = await listMcpTools()
      return { success: true, tools }
    } catch (e) {
      return { success: false, error: e.message, tools: [] }
    }
  })

  // ── Open directory picker ─────────────────────────────────────────────────
  ipcMain.handle('vespo:open-directory-dialog', async () => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select directory to track'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── Open path in OS file manager ──────────────────────────────────────────
  ipcMain.handle('vespo:open-path', async (_e, { path: p }) => {
    await shell.openPath(p)
  })

  // ── Open external URL ─────────────────────────────────────────────────────
  ipcMain.handle('vespo:open-url', async (_e, { url }) => {
    await shell.openExternal(url)
  })

  // ── Settings ──────────────────────────────────────────────────────────────
  ipcMain.handle('vespo:get-settings', async () => getSettings())

  ipcMain.handle('vespo:save-settings', async (_e, partial) => {
    const saved = await saveSettings(partial)
    emit('success', 'Settings saved')
    return saved
  })

  // ── Refresh Codex config ──────────────────────────────────────────────────
  ipcMain.handle('vespo:refresh-codex-config', async () => {
    try {
      const result = await checkAndUpdateCodexConfig()
      emit(result.updated ? 'success' : 'info', result.message)
      return { success: true, ...result }
    } catch (e) {
      emit('error', `Codex config update failed: ${e.message}`)
      return { success: false, error: e.message }
    }
  })

  // ── Tracked directories ───────────────────────────────────────────────────

  /**
   * Return all tracked directories merged with live watcher stats.
   * Shape: [{ path, collection, addedAt, active, filesIngested, lastIngest, lastIngestRel }]
   */
  ipcMain.handle('vespo:get-tracked-dirs', async () => {
    const settings = await getSettings()
    const liveStats = getWatcherStats() // from in-memory registry
    const liveMap = new Map(liveStats.map(s => [s.path, s]))

    return (settings.trackedDirectories || []).map(dir => {
      const live = liveMap.get(dir.path) || {}
      return {
        path: dir.path,
        collection: dir.collection,
        addedAt: dir.addedAt,
        active: isWatching(dir.path),
        filesIngested: live.filesIngested ?? 0,
        lastIngest: live.lastIngest ?? null,
        lastIngestRel: formatRelativeTime(live.lastIngest),
      }
    })
  })

  /**
   * Add a directory to persistent tracking and start the fs watcher.
   * collection is auto-derived from the dir name if not provided.
   */
  ipcMain.handle('vespo:add-tracked-dir', async (_e, { path: dirPath, collection }) => {
    if (!dirPath) return { success: false, error: 'No path provided' }

    const resolvedCollection = collection || collectionNameFromPath(dirPath)

    // Start the watcher first
    const settings = await getSettings()
    const watchResult = startWatching(dirPath, {
      collection: resolvedCollection,
      openaiApiKey: settings.openaiApiKey || ''
    }, emit)

    if (!watchResult.success) {
      return { success: false, error: watchResult.error }
    }

    // Persist to settings
    const existing = (settings.trackedDirectories || [])
    const alreadyTracked = existing.some(d => d.path === dirPath)
    if (!alreadyTracked) {
      await saveSettings({
        trackedDirectories: [
          ...existing,
          { path: dirPath, collection: resolvedCollection, addedAt: new Date().toISOString() }
        ]
      })
    }

    emit('success', `Now watching: ${dirPath}`)
    return { success: true, collection: resolvedCollection }
  })

  /**
   * Remove a tracked directory — stops the watcher and removes from settings.
   */
  ipcMain.handle('vespo:remove-tracked-dir', async (_e, { path: dirPath }) => {
    stopWatching(dirPath)

    const settings = await getSettings()
    await saveSettings({
      trackedDirectories: (settings.trackedDirectories || []).filter(d => d.path !== dirPath)
    })

    emit('info', `Stopped watching: ${dirPath}`)
    return { success: true }
  })
}

/**
 * Called at startup to resume watching all tracked directories from settings.
 * `emit` is the same function used by the IPC handlers.
 */
export async function restoreWatchers(settings, emit) {
  const dirs = settings.trackedDirectories || []
  for (const dir of dirs) {
    if (!isWatching(dir.path)) {
      startWatching(dir.path, {
        collection: dir.collection,
        openaiApiKey: settings.openaiApiKey || ''
      }, emit)
    }
  }
}
