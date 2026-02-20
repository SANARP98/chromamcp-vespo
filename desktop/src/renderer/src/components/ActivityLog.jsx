import { useEffect, useRef, useState } from 'react'
import { CheckCircle, AlertCircle, Info } from './Icons'

const LEVEL_STYLES = {
  success: { icon: CheckCircle, color: 'text-vespo-green',  dot: 'bg-vespo-green' },
  error:   { icon: AlertCircle, color: 'text-vespo-red',    dot: 'bg-vespo-red' },
  warn:    { icon: AlertCircle, color: 'text-vespo-yellow', dot: 'bg-vespo-yellow' },
  info:    { icon: Info,        color: 'text-vespo-muted',  dot: 'bg-vespo-muted' }
}

function ActivityEntry({ entry }) {
  const { icon: Icon, color, dot } = LEVEL_STYLES[entry.level] || LEVEL_STYLES.info
  return (
    <div className="flex items-start gap-2 px-3 py-1.5 hover:bg-white/[0.02] group">
      <span className="text-xs text-vespo-muted font-mono flex-shrink-0 w-16 pt-0.5">
        {entry.time}
      </span>
      <span className={`flex-shrink-0 pt-0.5 ${color}`}>
        <Icon size={12} />
      </span>
      <span className="text-xs text-vespo-text leading-relaxed break-all">{entry.message}</span>
    </div>
  )
}

export default function ActivityLog({ activities }) {
  const [filter, setFilter]       = useState('all')   // 'all' | 'error' | 'success'
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef(null)
  const containerRef = useRef(null)

  const filtered = filter === 'all'
    ? activities
    : activities.filter(a => a.level === filter)

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activities, autoScroll])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-vespo-border flex-shrink-0">
        <span className="text-xs font-semibold text-vespo-muted uppercase tracking-wider">Activity</span>
        <div className="flex items-center gap-2">
          {/* Filter pills */}
          {['all', 'success', 'error'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                filter === f
                  ? 'bg-vespo-border text-vespo-text'
                  : 'text-vespo-muted hover:text-vespo-text'
              }`}
            >
              {f}
            </button>
          ))}
          {/* Auto-scroll indicator */}
          <button
            onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              autoScroll ? 'text-vespo-accent' : 'text-vespo-muted hover:text-vespo-text'
            }`}
            title="Scroll to bottom"
          >
            ↓
          </button>
        </div>
      </div>

      {/* Entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto flex flex-col-reverse"
      >
        {/* Bottom anchor for auto-scroll */}
        <div ref={bottomRef} />

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-vespo-muted">
            {filter === 'all' ? 'Activity will appear here' : `No ${filter} events`}
          </div>
        ) : (
          <div className="flex flex-col">
            {[...filtered].reverse().map((entry, i) => (
              <ActivityEntry key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
