import { useState, useEffect, useCallback } from 'react'
import { FolderPlus, Folder, Search, Eye, EyeOff, X, Clock } from './Icons'

// ─── Tracked directory row ────────────────────────────────────────────────────

function TrackedDirRow({ dir, onRemove }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 hover:bg-white/[0.02] group border-b border-vespo-border last:border-0">
      <Eye size={11} className="text-vespo-accent flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-vespo-text truncate" title={dir.path}>
          {dir.path}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-vespo-muted font-mono">{dir.collection}</span>
          {dir.active ? (
            <span className="text-xs text-vespo-green flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-vespo-green inline-block" />
              watching
            </span>
          ) : (
            <span className="text-xs text-vespo-red flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-vespo-red inline-block" />
              inactive
            </span>
          )}
          {dir.filesIngested > 0 && (
            <span className="text-xs text-vespo-muted">{dir.filesIngested} files</span>
          )}
          {dir.lastIngestRel && (
            <span className="text-xs text-vespo-muted flex items-center gap-0.5">
              <Clock size={10} />
              {dir.lastIngestRel}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(dir.path)}
        className="p-1 rounded hover:bg-red-500/20 text-vespo-muted hover:text-vespo-red opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
        title="Stop watching"
      >
        <X size={11} />
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DirectoryPanel({ status, onRefresh, addActivity }) {
  const [scanning, setScanning]       = useState(false)
  const [scanResult, setScanResult]   = useState(null)
  const [trackedDirs, setTrackedDirs] = useState([])
  const [addingWatch, setAddingWatch] = useState(false)

  // Poll tracked dirs every 5 s to pick up live filesIngested / lastIngest updates
  const refreshTracked = useCallback(async () => {
    const dirs = await window.vespo.getTrackedDirs()
    setTrackedDirs(dirs)
  }, [])

  useEffect(() => {
    refreshTracked()
    const id = setInterval(refreshTracked, 5000)
    return () => clearInterval(id)
  }, [refreshTracked])

  // ── One-time scan & ingest ─────────────────────────────────────────────────

  async function handleAddDirectory() {
    const dirPath = await window.vespo.openDirectoryDialog()
    if (!dirPath) return

    setScanResult(null)
    setScanning(true)
    addActivity('info', `Scanning: ${dirPath}`)

    const result = await window.vespo.scanDirectory(dirPath)
    setScanning(false)

    if (result.success) {
      setScanResult({ path: dirPath, ...result })
      addActivity('success', `Scan complete: ${result.total_files ?? result.files_found ?? '?'} files found`)
    } else {
      addActivity('error', `Scan failed: ${result.error}`)
    }
  }

  async function handleIngest() {
    if (!scanResult) return
    addActivity('info', `Ingesting: ${scanResult.path}`)
    const result = await window.vespo.runTool('batch_ingest', {
      path: scanResult.path,
      recursive: true
    })
    if (result.success) {
      addActivity('success', `Ingested ${result.result?.files_stored ?? '?'} chunks`)
      setScanResult(null)
      onRefresh()
    } else {
      addActivity('error', `Ingest failed: ${result.error}`)
    }
  }

  // ── Watch directory ────────────────────────────────────────────────────────

  async function handleWatchDirectory() {
    const dirPath = await window.vespo.openDirectoryDialog()
    if (!dirPath) return

    setAddingWatch(true)
    const result = await window.vespo.addTrackedDir(dirPath)
    setAddingWatch(false)

    if (result.success) {
      addActivity('success', `Watching: ${dirPath} → "${result.collection}"`)
      await refreshTracked()
      onRefresh()
    } else {
      addActivity('error', `Watch failed: ${result.error}`)
    }
  }

  async function handleRemoveTracked(dirPath) {
    await window.vespo.removeTrackedDir(dirPath)
    await refreshTracked()
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col border-b border-vespo-border overflow-hidden" style={{ maxHeight: '60%' }}>

      {/* ── One-time ingest section ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-vespo-border flex-shrink-0">
        <span className="text-xs font-semibold text-vespo-muted uppercase tracking-wider">Ingest</span>
        <button
          onClick={handleAddDirectory}
          disabled={scanning}
          className="flex items-center gap-1 text-xs text-vespo-accent hover:text-blue-300 disabled:opacity-40 transition-colors"
          title="Scan a directory once and ingest all files"
        >
          <FolderPlus size={13} />
          {scanning ? 'Scanning…' : 'Scan & Ingest'}
        </button>
      </div>

      <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: '45%' }}>
        <div className="p-2 space-y-2">
          {!scanResult && !scanning && (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <Folder size={22} className="text-vespo-border mb-1.5" />
              <p className="text-xs text-vespo-muted">Select a directory to scan and ingest once</p>
            </div>
          )}

          {scanning && (
            <div className="flex items-center gap-2 text-xs text-vespo-muted py-3 justify-center">
              <span className="animate-spin">⟳</span> Scanning files…
            </div>
          )}

          {scanResult && (
            <div className="rounded border border-vespo-border bg-vespo-surface p-3 space-y-3">
              <div className="text-xs font-mono text-vespo-text truncate" title={scanResult.path}>
                {scanResult.path}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {scanResult.total_files != null && (
                  <>
                    <span className="text-vespo-muted">Files found</span>
                    <span className="text-right font-mono">{scanResult.total_files}</span>
                  </>
                )}
                {scanResult.by_category && Object.entries(scanResult.by_category).map(([cat, n]) => (
                  n > 0 && [
                    <span key={`k-${cat}`} className="text-vespo-muted capitalize">{cat}</span>,
                    <span key={`v-${cat}`} className="text-right font-mono">{n}</span>
                  ]
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleIngest}
                  className="flex-1 flex items-center justify-center gap-1 bg-vespo-accent/20 hover:bg-vespo-accent/30 text-vespo-accent text-xs py-1.5 rounded transition-colors"
                >
                  <Search size={11} /> Ingest All
                </button>
                <button
                  onClick={() => setScanResult(null)}
                  className="text-xs text-vespo-muted hover:text-vespo-text px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Watched directories section ───────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-b border-vespo-border flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-vespo-muted uppercase tracking-wider">Watched</span>
          {trackedDirs.length > 0 && (
            <span className="text-xs text-vespo-muted bg-vespo-border px-1.5 py-0.5 rounded-full">
              {trackedDirs.length}
            </span>
          )}
        </div>
        <button
          onClick={handleWatchDirectory}
          disabled={addingWatch}
          className="flex items-center gap-1 text-xs text-vespo-accent hover:text-blue-300 disabled:opacity-40 transition-colors"
          title="Watch a directory for new files and auto-ingest them"
        >
          <Eye size={12} />
          {addingWatch ? 'Adding…' : 'Watch Dir'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {trackedDirs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-5 text-center px-3">
            <EyeOff size={18} className="text-vespo-border mb-1.5" />
            <p className="text-xs text-vespo-muted">No watched directories</p>
            <p className="text-xs text-vespo-muted mt-0.5">New files dropped here will auto-ingest</p>
          </div>
        ) : (
          trackedDirs.map(dir => (
            <TrackedDirRow key={dir.path} dir={dir} onRemove={handleRemoveTracked} />
          ))
        )}
      </div>

    </div>
  )
}
