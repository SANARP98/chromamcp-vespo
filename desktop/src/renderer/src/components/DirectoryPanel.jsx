import { useState } from 'react'
import { FolderPlus, Folder, Search } from './Icons'

export default function DirectoryPanel({ status, onRefresh, addActivity }) {
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)

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

  return (
    <div className="flex flex-col border-b border-vespo-border overflow-hidden" style={{ maxHeight: '55%' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-vespo-border flex-shrink-0">
        <span className="text-xs font-semibold text-vespo-muted uppercase tracking-wider">Ingest</span>
        <button
          onClick={handleAddDirectory}
          disabled={scanning}
          className="flex items-center gap-1 text-xs text-vespo-accent hover:text-blue-300 disabled:opacity-40 transition-colors"
          title="Select a directory to scan"
        >
          <FolderPlus size={13} />
          {scanning ? 'Scanning…' : 'Add Directory'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">

        {!scanResult && !scanning && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Folder size={28} className="text-vespo-border mb-2" />
            <p className="text-xs text-vespo-muted">Select a directory to scan and ingest into a collection</p>
          </div>
        )}

        {scanning && (
          <div className="flex items-center gap-2 text-xs text-vespo-muted py-4 justify-center">
            <span className="animate-spin">⟳</span> Scanning files…
          </div>
        )}

        {scanResult && (
          <div className="rounded border border-vespo-border bg-vespo-surface p-3 space-y-3">
            <div className="text-xs font-mono text-vespo-text truncate" title={scanResult.path}>
              {scanResult.path}
            </div>

            {/* Stats grid */}
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

            {/* Actions */}
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
  )
}
