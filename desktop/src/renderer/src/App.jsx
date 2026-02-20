import { useState, useEffect, useRef, useCallback } from 'react'
import Header from './components/Header'
import DirectoryPanel from './components/DirectoryPanel'
import CollectionsPanel from './components/CollectionsPanel'
import ActivityLog from './components/ActivityLog'
import Settings from './components/Settings'
import ToolsPanel from './components/ToolsPanel'

export default function App() {
  const [status, setStatus]           = useState(null)
  const [collections, setCollections] = useState([])
  const [activities, setActivities]   = useState([])
  const [activeTab, setActiveTab]     = useState('dashboard') // 'dashboard' | 'tools' | 'settings'
  const [loading, setLoading]         = useState(true)

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    const [s, c] = await Promise.all([
      window.vespo.getStatus(),
      window.vespo.getCollections()
    ])
    setStatus(s)
    setCollections(c)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    // Subscribe to activity log events pushed from main process
    const cleanup = window.vespo.onActivity((entry) => {
      setActivities(prev => [entry, ...prev].slice(0, 200)) // keep last 200
    })
    // Refresh every 30s so collection list stays up-to-date
    const interval = setInterval(refresh, 30_000)
    return () => { cleanup(); clearInterval(interval) }
  }, [refresh])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const addActivity = useCallback((level, message) => {
    setActivities(prev =>
      [{ time: new Date().toLocaleTimeString('en-GB', { hour12: false }), level, message }, ...prev].slice(0, 200)
    )
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-vespo-bg text-vespo-text select-none">
      <Header
        status={status}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={refresh}
      />

      {activeTab === 'settings' ? (
        <Settings status={status} onRefresh={refresh} addActivity={addActivity} />
      ) : activeTab === 'tools' ? (
        <ToolsPanel addActivity={addActivity} />
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div className="flex flex-col w-72 min-w-0 border-r border-vespo-border overflow-hidden">
            <DirectoryPanel
              status={status}
              onRefresh={refresh}
              addActivity={addActivity}
            />
            <CollectionsPanel
              collections={collections}
              loading={loading}
              onRefresh={refresh}
              addActivity={addActivity}
            />
          </div>

          {/* ── Right column ────────────────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <ActivityLog activities={activities} />
          </div>

        </div>
      )}
    </div>
  )
}
