/**
 * preload/index.js
 *
 * Runs in an isolated context before the renderer loads.
 * Exposes a safe, typed window.vespo API via contextBridge —
 * the renderer never has direct access to Node or Electron APIs.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vespo', {

  // ── Status & settings ────────────────────────────────────────────────────
  getStatus: () => ipcRenderer.invoke('vespo:get-status'),
  getSettings: () => ipcRenderer.invoke('vespo:get-settings'),
  saveSettings: (partial) => ipcRenderer.invoke('vespo:save-settings', partial),

  // ── Collections ──────────────────────────────────────────────────────────
  getCollections: () => ipcRenderer.invoke('vespo:get-collections'),
  getCollectionInfo: (collection) => ipcRenderer.invoke('vespo:get-collection-info', { collection }),
  deleteCollection: (collection) => ipcRenderer.invoke('vespo:delete-collection', { collection }),

  // ── Tools ────────────────────────────────────────────────────────────────
  scanDirectory: (path) => ipcRenderer.invoke('vespo:scan-directory', { path }),
  runTool: (tool, args) => ipcRenderer.invoke('vespo:run-tool', { tool, args }),

  // ── UI helpers ───────────────────────────────────────────────────────────
  openDirectoryDialog: () => ipcRenderer.invoke('vespo:open-directory-dialog'),
  openPath: (path) => ipcRenderer.invoke('vespo:open-path', { path }),
  openUrl: (url) => ipcRenderer.invoke('vespo:open-url', { url }),

  // ── Codex config ─────────────────────────────────────────────────────────
  refreshCodexConfig: () => ipcRenderer.invoke('vespo:refresh-codex-config'),

  // ── Tracked directories ───────────────────────────────────────────────────
  getTrackedDirs: () => ipcRenderer.invoke('vespo:get-tracked-dirs'),
  addTrackedDir: (path, collection) => ipcRenderer.invoke('vespo:add-tracked-dir', { path, collection }),
  removeTrackedDir: (path) => ipcRenderer.invoke('vespo:remove-tracked-dir', { path }),

  // ── Activity log (main → renderer push) ─────────────────────────────────
  onActivity: (callback) => {
    const handler = (_event, entry) => callback(entry)
    ipcRenderer.on('vespo:activity', handler)
    // Return cleanup function
    return () => ipcRenderer.removeListener('vespo:activity', handler)
  }
})
