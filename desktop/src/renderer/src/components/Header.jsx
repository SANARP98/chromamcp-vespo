import { RefreshCw, Settings, Database, Wrench } from './Icons'

function StatusDot({ ok, label }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-vespo-green' : 'bg-vespo-red'}`} />
      <span className={ok ? 'text-vespo-muted' : 'text-vespo-red'}>{label}</span>
    </span>
  )
}

export default function Header({ status, activeTab, onTabChange, onRefresh }) {
  return (
    <div
      className="drag-region flex items-center justify-between px-4 h-11 border-b border-vespo-border bg-vespo-surface flex-shrink-0"
    >
      {/* ── Left: brand + status ──────────────────────────────────────────── */}
      <div className="no-drag flex items-center gap-4">
        <span className="font-semibold text-vespo-text tracking-tight">vespo</span>

        {status ? (
          <>
            <StatusDot ok={status.codexConfigured} label="Codex" />
            <StatusDot ok={status.dbExists}        label="DB" />
          </>
        ) : (
          <span className="text-xs text-vespo-muted">loading…</span>
        )}
      </div>

      {/* ── Right: nav + actions ──────────────────────────────────────────── */}
      <div className="no-drag flex items-center gap-1">

        {/* DB path badge */}
        {status?.dbPath && (
          <button
            onClick={() => window.vespo.openPath(status.dbPath)}
            className="hidden sm:flex items-center gap-1 text-xs text-vespo-muted hover:text-vespo-accent px-2 py-1 rounded hover:bg-white/5 transition-colors"
            title="Open DB folder"
          >
            <Database size={11} />
            <span className="max-w-[160px] truncate">{status.dbPath}</span>
          </button>
        )}

        {/* Dashboard tab */}
        <button
          onClick={() => onTabChange('dashboard')}
          className={`text-xs px-3 py-1.5 rounded transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-vespo-border text-vespo-text'
              : 'text-vespo-muted hover:text-vespo-text hover:bg-white/5'
          }`}
        >
          Dashboard
        </button>

        {/* Settings tab */}
        <button
          onClick={() => onTabChange('tools')}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded transition-colors ${
            activeTab === 'tools'
              ? 'bg-vespo-border text-vespo-text'
              : 'text-vespo-muted hover:text-vespo-text hover:bg-white/5'
          }`}
        >
          <Wrench size={12} />
          Tools
        </button>

        {/* Settings tab */}
        <button
          onClick={() => onTabChange('settings')}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded transition-colors ${
            activeTab === 'settings'
              ? 'bg-vespo-border text-vespo-text'
              : 'text-vespo-muted hover:text-vespo-text hover:bg-white/5'
          }`}
        >
          <Settings size={12} />
          Settings
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="text-vespo-muted hover:text-vespo-text p-1.5 rounded hover:bg-white/5 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>

      </div>
    </div>
  )
}
