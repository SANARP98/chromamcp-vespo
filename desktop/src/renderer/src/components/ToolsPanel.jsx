import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Wrench } from './Icons'

function pretty(v) {
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

export default function ToolsPanel({ addActivity }) {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [argsText, setArgsText] = useState('{}')
  const [running, setRunning] = useState(false)
  const [resultText, setResultText] = useState('')

  async function refreshTools() {
    setLoading(true)
    setError(null)
    const res = await window.vespo.listTools()
    if (!res.success) {
      setError(res.error || 'Failed to load tools')
      setLoading(false)
      return
    }
    const sorted = [...(res.tools || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setTools(sorted)
    if (!selected && sorted.length > 0) {
      setSelected(sorted[0])
      setArgsText('{}')
    }
    setLoading(false)
  }

  useEffect(() => {
    refreshTools()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tools
    return tools.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    )
  }, [query, tools])

  function applyTemplate(tool) {
    const props = tool?.inputSchema?.properties || {}
    const tmpl = {}
    for (const [k, v] of Object.entries(props)) {
      if (v.default !== undefined) tmpl[k] = v.default
      else if (v.type === 'boolean') tmpl[k] = false
      else if (v.type === 'integer' || v.type === 'number') tmpl[k] = 0
      else if (v.type === 'array') tmpl[k] = []
      else if (v.type === 'object') tmpl[k] = {}
      else tmpl[k] = ''
    }
    setArgsText(pretty(tmpl))
  }

  async function runSelectedTool() {
    if (!selected || running) return
    let parsedArgs = {}
    try {
      parsedArgs = argsText.trim() ? JSON.parse(argsText) : {}
    } catch (e) {
      setResultText(`Invalid JSON args: ${e.message}`)
      addActivity('error', `Invalid args for ${selected.name}`)
      return
    }

    setRunning(true)
    addActivity('info', `Running tool: ${selected.name}`)
    const res = await window.vespo.runTool(selected.name, parsedArgs)
    setRunning(false)

    if (res.success) {
      setResultText(pretty(res.result))
      addActivity('success', `Completed: ${selected.name}`)
    } else {
      setResultText(`Error: ${res.error}`)
      addActivity('error', `${selected.name} failed: ${res.error}`)
    }
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className="w-80 border-r border-vespo-border flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-vespo-border flex items-center gap-2">
          <Wrench size={12} className="text-vespo-accent" />
          <span className="text-xs font-semibold text-vespo-muted uppercase tracking-wider">Tools</span>
          <span className="text-xs text-vespo-muted">{tools.length}</span>
          <button
            onClick={refreshTools}
            className="ml-auto text-vespo-muted hover:text-vespo-text transition-colors"
            title="Refresh tools"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="p-2 border-b border-vespo-border">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full bg-vespo-surface border border-vespo-border rounded px-2 py-1.5 text-xs text-vespo-text outline-none focus:border-vespo-accent"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="px-3 py-3 text-xs text-vespo-muted">Loading tools...</div>}
          {!loading && error && <div className="px-3 py-3 text-xs text-vespo-red">{error}</div>}
          {!loading && !error && filtered.map((t) => (
            <button
              key={t.name}
              onClick={() => { setSelected(t); setResultText('') }}
              className={`w-full text-left px-3 py-2 border-b border-vespo-border/60 hover:bg-white/[0.03] ${
                selected?.name === t.name ? 'bg-white/[0.05]' : ''
              }`}
            >
              <div className="text-xs font-mono text-vespo-text">{t.name}</div>
              <div className="text-xs text-vespo-muted mt-0.5 line-clamp-2">{t.description || 'No description'}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-4 py-3 border-b border-vespo-border">
          <div className="text-sm font-semibold text-vespo-text">{selected?.name || 'Select a tool'}</div>
          {selected?.description && <div className="text-xs text-vespo-muted mt-1">{selected.description}</div>}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-vespo-muted uppercase tracking-wider">Args (JSON)</span>
              <button
                onClick={() => applyTemplate(selected)}
                disabled={!selected}
                className="text-xs px-2 py-1 rounded border border-vespo-border text-vespo-muted hover:text-vespo-text hover:bg-white/5 disabled:opacity-50"
              >
                Use Template
              </button>
            </div>
            <textarea
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              spellCheck={false}
              className="w-full h-44 bg-vespo-surface border border-vespo-border rounded p-2 font-mono text-xs text-vespo-text outline-none focus:border-vespo-accent"
            />
          </div>

          {selected?.inputSchema && (
            <div>
              <div className="text-xs text-vespo-muted uppercase tracking-wider mb-1.5">Schema</div>
              <pre className="bg-vespo-surface border border-vespo-border rounded p-2 text-xs text-vespo-muted overflow-auto max-h-52">{pretty(selected.inputSchema)}</pre>
            </div>
          )}

          <div>
            <div className="text-xs text-vespo-muted uppercase tracking-wider mb-1.5">Result</div>
            <pre className="bg-vespo-surface border border-vespo-border rounded p-2 text-xs text-vespo-text overflow-auto min-h-36 whitespace-pre-wrap">{resultText || 'Run a tool to see output.'}</pre>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-vespo-border flex justify-end">
          <button
            onClick={runSelectedTool}
            disabled={!selected || running}
            className="text-xs px-3 py-1.5 rounded bg-vespo-accent/20 hover:bg-vespo-accent/30 text-vespo-accent disabled:opacity-50"
          >
            {running ? 'Running...' : 'Run Tool'}
          </button>
        </div>
      </div>
    </div>
  )
}
