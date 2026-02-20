import { useState, useEffect } from 'react'
import { Key, CheckCircle, AlertCircle, ExternalLink, RefreshCw } from './Icons'

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-vespo-text">{label}</label>
      {children}
      {hint && <p className="text-xs text-vespo-muted">{hint}</p>}
    </div>
  )
}

function StatusRow({ label, ok, detail }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-vespo-border last:border-0">
      <span className="text-xs text-vespo-muted">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-vespo-muted font-mono truncate max-w-[240px]">{detail}</span>}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-vespo-green' : 'bg-vespo-red'}`} />
      </div>
    </div>
  )
}

export default function Settings({ status, onRefresh, addActivity }) {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    window.vespo.getSettings().then(setSettings)
  }, [])

  if (!settings) {
    return <div className="flex-1 flex items-center justify-center text-xs text-vespo-muted">Loading…</div>
  }

  function handleChange(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await window.vespo.saveSettings(settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleRefreshCodex() {
    const result = await window.vespo.refreshCodexConfig()
    addActivity(result.success ? 'success' : 'error', result.message || result.error || 'Done')
    onRefresh()
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto space-y-8">

        {/* ── Status ───────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-vespo-text mb-3">Status</h2>
          <div className="rounded border border-vespo-border divide-y divide-vespo-border bg-vespo-surface px-3">
            <StatusRow label="Codex CLI configured"  ok={status?.codexConfigured}    detail={status?.codexConfigured ? 'config.toml ✓' : 'not configured'} />
            <StatusRow label="MCP server path"       ok={!!status?.mcpServerPath}    detail={status?.mcpServerPath} />
            <StatusRow label="LanceDB"               ok={status?.dbExists}           detail={status?.dbPath} />
            <StatusRow label="Collections"           ok={status?.collectionCount > 0} detail={`${status?.collectionCount ?? 0} collections · ${status?.totalSize ?? '0 B'}`} />
          </div>
        </section>

        {/* ── OpenAI API Key ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-vespo-text mb-3">Embeddings</h2>
          <div className="space-y-4">
            <Field
              label="OpenAI API Key"
              hint="Required for smart_ingest with high-quality text-embedding-3-large vectors. Leave blank to use local MiniLM embeddings (free, offline)."
            >
              <div className="flex items-center gap-2">
                <Key size={13} className="text-vespo-muted flex-shrink-0" />
                <input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={e => handleChange('openaiApiKey', e.target.value)}
                  placeholder="sk-…"
                  className="flex-1 bg-vespo-bg border border-vespo-border rounded px-3 py-1.5 text-xs text-vespo-text font-mono placeholder-vespo-muted focus:outline-none focus:border-vespo-accent"
                />
              </div>
            </Field>
          </div>
        </section>

        {/* ── Codex config ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-vespo-text mb-3">Codex CLI Integration</h2>
          <div className="space-y-3">
            <p className="text-xs text-vespo-muted">
              Vespo automatically updates <code className="text-vespo-accent">~/.codex/config.toml</code> on startup to
              point to the bundled MCP server. Click below to force a refresh.
            </p>
            <button
              onClick={handleRefreshCodex}
              className="flex items-center gap-2 text-xs bg-vespo-surface border border-vespo-border hover:border-vespo-accent text-vespo-text px-3 py-2 rounded transition-colors"
            >
              <RefreshCw size={12} /> Refresh Codex Config
            </button>
            {status?.mcpServerPath && (
              <div className="text-xs text-vespo-muted font-mono bg-vespo-bg rounded px-3 py-2 border border-vespo-border">
                {status.mcpServerPath}
              </div>
            )}
          </div>
        </section>

        {/* ── Save ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-vespo-accent/20 hover:bg-vespo-accent/30 text-vespo-accent border border-vespo-accent/30 text-xs px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-vespo-green">
              <CheckCircle size={12} /> Saved
            </span>
          )}
        </div>

      </div>
    </div>
  )
}
