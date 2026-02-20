import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerIpcHandlers, restoreWatchers } from './ipc-handlers'
import { checkAndUpdateCodexConfig } from './codex-config'
import { getSettings } from './store'
import { stopAllWatchers } from './directory-watcher'

// Keep strong references to prevent GC
let mainWindow = null
let tray = null

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 580,
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (!app.isPackaged) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function setupTray() {
  try {
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'build', 'icon.png')
      : join(__dirname, '../../build/icon.png')
    const img = existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty()

    tray = new Tray(img)
    tray.setToolTip('Vespo')
    updateTrayMenu()

    tray.on('double-click', () => {
      if (mainWindow) mainWindow.show()
      else createWindow()
    })
  } catch (e) {
    // Tray is non-critical — skip if it fails (e.g. no icon on first run)
    console.error('[tray] setup failed:', e.message)
  }
}

function updateTrayMenu(status = {}) {
  if (!tray) return
  const label = status.mcpConfigured ? 'MCP: configured' : 'MCP: not configured'
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Vespo', click: () => { if (mainWindow) mainWindow.show(); else createWindow() } },
    { label, enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]))
}

// ─── Startup ─────────────────────────────────────────────────────────────────

function emit(level, message) {
  const entry = { time: new Date().toLocaleTimeString('en-GB', { hour12: false }), level, message }
  mainWindow?.webContents.send('vespo:activity', entry)
}

app.whenReady().then(async () => {
  // Register IPC before creating window so handlers exist on first render
  registerIpcHandlers(ipcMain, () => mainWindow, emit)

  createWindow()
  setupTray()

  // Emit startup sequence
  emit('info', 'Vespo starting…')
  emit('info', `DB path: ${join(require('os').homedir(), '.vespo', 'lancedb')}`)

  // Auto-configure Codex CLI
  try {
    const result = await checkAndUpdateCodexConfig()
    emit(result.updated ? 'success' : 'info', result.message)
    updateTrayMenu({ mcpConfigured: true })
  } catch (e) {
    emit('error', `Codex config: ${e.message}`)
  }

  // Restore persistent directory watchers from settings
  try {
    const settings = await getSettings()
    await restoreWatchers(settings, emit)
    const count = (settings.trackedDirectories || []).length
    if (count > 0) emit('info', `Resumed ${count} watched director${count === 1 ? 'y' : 'ies'}`)
  } catch (e) {
    emit('error', `Failed to restore watchers: ${e.message}`)
  }

  emit('success', 'Ready')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopAllWatchers()
})

