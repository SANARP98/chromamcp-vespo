import { useState } from 'react'
import { Database, Trash2, Download, ExternalLink, RefreshCw } from './Icons'

export default function CollectionsPanel({ collections, loading, onRefresh, addActivity }) {
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [info, setInfo] = useState({}) // collectionName → info data

  async function handleDelete(name) {
    if (deleting) return
    const confirmed = window.confirm(`Delete collection "${name}"? This cannot be undone.`)
    if (!confirmed) return
    setDeleting(name)
    const result = await window.vespo.deleteCollection(name)
    setDeleting(null)
    if (result.success) {
      setInfo(prev => { const n = { ...prev }; delete n[name]; return n })
      onRefresh()
    }
  }

  async function handleExpand(name) {
    if (expanded === name) { setExpanded(null); return }
    setExpanded(name)
    if (!info[name]) {
      const result = await window.vespo.getCollectionInfo(name)
      if (result.success) setInfo(prev => ({ ...prev, [name]: result }))
    }
  }

  async function handleExport(name) {
    addActivity('info', `Exporting: ${name}`)
    const result = await window.vespo.runTool('export_collection', { collection: name })
    if (result.success) {
      addActivity('success', `Exported ${name}`)
    } else {
      addActivity('error', `Export failed: ${result.error}`)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-vespo-border flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-vespo-muted uppercase tracking-wider">Collections</span>
          {collections.length > 0 && (
            <span className="text-xs text-vespo-muted bg-vespo-border px-1.5 py-0.5 rounded-full">
              {collections.length}
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="text-vespo-muted hover:text-vespo-text transition-colors"
          title="Refresh collections"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-6 text-xs text-vespo-muted">
            Loading…
          </div>
        )}

        {!loading && collections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center px-4">
            <Database size={24} className="text-vespo-border mb-2" />
            <p className="text-xs text-vespo-muted">No collections yet</p>
            <p className="text-xs text-vespo-muted mt-1">Ingest a directory above to create one</p>
          </div>
        )}

        {collections.map((col) => (
          <div key={col.name} className="border-b border-vespo-border last:border-0">
            {/* Row */}
            <div
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] cursor-pointer group"
              onClick={() => handleExpand(col.name)}
            >
              <Database size={12} className="text-vespo-accent flex-shrink-0" />
              <span className="flex-1 text-xs truncate font-mono" title={col.name}>{col.name}</span>
              <span className="text-xs text-vespo-muted flex-shrink-0">{col.size}</span>

              {/* Action buttons shown on hover */}
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity no-drag">
                <button
                  onClick={(e) => { e.stopPropagation(); handleExport(col.name) }}
                  className="p-1 rounded hover:bg-white/10 text-vespo-muted hover:text-vespo-text transition-colors"
                  title="Export"
                >
                  <Download size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(col.name) }}
                  disabled={deleting === col.name}
                  className="p-1 rounded hover:bg-red-500/20 text-vespo-muted hover:text-vespo-red transition-colors disabled:opacity-40"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {/* Expanded info */}
            {expanded === col.name && (
              <div className="px-4 pb-3 bg-vespo-bg text-xs space-y-1">
                {info[col.name] ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-vespo-muted">Documents</span>
                      <span className="font-mono">{info[col.name].document_count ?? '—'}</span>
                    </div>
                    {info[col.name].sample_categories && Object.entries(info[col.name].sample_categories).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-vespo-muted capitalize">{k}</span>
                        <span className="font-mono">{v}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <span className="text-vespo-muted">Loading info…</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
