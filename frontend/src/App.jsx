/**
 * @fileoverview App.jsx — Root application component for OrbitalWatch.
 * Wired with charts, FilterBar, live stats, and toast alerts.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { AppProvider, useAppContext } from './context/AppContext.jsx'
import MainLayout from './components/Layout/MainLayout.jsx'
import ThreeGlobe from './components/Globe/ThreeGlobe.jsx'

// Dashboard components
import SearchBar         from './components/Dashboard/SearchBar.jsx'
import SatelliteInfo     from './components/Dashboard/SatelliteInfo.jsx'
import StatsCards        from './components/Dashboard/StatsCards.jsx'
import AlertPanel        from './components/Dashboard/AlertPanel.jsx'
import AlertDetail       from './components/Dashboard/AlertDetail.jsx'
import FilterBar         from './components/Dashboard/FilterBar.jsx'
import AltitudeChart     from './components/Dashboard/AltitudeChart.jsx'
import TypeDistribution  from './components/Dashboard/TypeDistribution.jsx'
import NotificationToast from './components/Dashboard/NotificationToast.jsx'

import useSatellites from './hooks/useSatellites.js'
import { fetchStats, fetchConjunctions } from './services/api.js'
import './index.css'

// ── Reset Camera Icon ─────────────────────────────────────────────────────────

const ResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

// ── StatChip (globe overlay) ──────────────────────────────────────────────────

/** @param {{ label: string, value: string, color: string }} props */
function StatChip({ label, value, color }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgba(5,5,12,0.75)',
        border: '1px solid var(--space-border-bright)',
        borderRadius: 'var(--radius-md)',
        padding: '0.35rem 0.7rem',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        minWidth: 70,
      }}
    >
      <span style={{ fontSize: '1rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {value}
      </span>
      <span style={{ fontSize: '0.62rem', color: 'var(--space-text-dim)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
        {label}
      </span>
    </div>
  )
}

StatChip.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { label: 'Payload',      color: '#00ff9d' },
    { label: 'Debris',       color: '#ff4d4d' },
    { label: 'Rocket Body',  color: '#ff9d00' },
    { label: 'Unknown',      color: '#888888' },
  ]
  return (
    <div
      id="globe-legend"
      style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        background: 'rgba(5,5,12,0.75)',
        border: '1px solid var(--space-border-bright)',
        borderRadius: 'var(--radius-md)',
        padding: '0.6rem 0.85rem',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: '0.62rem', color: 'var(--space-text-dim)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
        Legend
      </div>
      {items.map(({ label, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--space-text-muted)' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── GlobeView ─────────────────────────────────────────────────────────────────

/**
 * Globe mode: ThreeGlobe + SearchBar overlay + StatsCards + SatelliteInfo + Charts.
 *
 * @param {{ onResetCamera: Function, controlsRef: Object, stats: Object }} props
 */
function GlobeView({ onResetCamera, controlsRef, stats }) {
  const { satellites, loading: satLoading } = useSatellites()
  const {
    connected,
    lastUpdate,
    filteredSatellites,
    filters,
    setFilters,
    setSelectedSatellite,
  } = useAppContext()

  const [selectedNoradId, setSelectedNoradId] = useState(/** @type {string|null} */ (null))

  const handleSelect = useCallback((noradId) => {
    setSelectedNoradId((prev) => (prev === noradId ? null : noradId))
    // sync to context
    const sat = satellites.find((s) => String(s.norad_id) === String(noradId))
    setSelectedSatellite(sat ?? null)
  }, [satellites, setSelectedSatellite])

  // SearchBar selection → set selectedNoradId to focus globe
  const handleSearchSelect = useCallback((sat) => {
    const id = String(sat.norad_id)
    setSelectedNoradId(id)
    setSelectedSatellite(sat)
  }, [setSelectedSatellite])

  // Listen for 3D preview event from AlertDetail
  useEffect(() => {
    const handler = (e) => {
      const { norad1 } = e.detail ?? {}
      if (norad1) setSelectedNoradId(String(norad1))
    }
    window.addEventListener('ow:focus-conjunction', handler)
    return () => window.removeEventListener('ow:focus-conjunction', handler)
  }, [])

  return (
    <div
      id="globe-dashboard"
      style={{
        position: 'relative',
        height: 'calc(100vh - var(--header-height))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* FilterBar above ThreeGlobe */}
      <div style={{ padding: '8px 16px', background: 'var(--space-bg)' }}>
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* ── Globe (top ~70%) ───────────────────────────────────────────────── */}
      <div style={{ flex: '0 0 62%', position: 'relative', minHeight: 0 }}>
        <ThreeGlobe
          satellites={satellites}
          positions={filteredSatellites}
          selectedNoradId={selectedNoradId}
          onSelect={handleSelect}
          controlsRef={controlsRef}
        />

        {/* SearchBar overlay – top centre */}
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            maxWidth: 520,
            zIndex: 20,
          }}
        >
          <SearchBar onSelect={handleSearchSelect} />
        </div>

        {/* Stats strip – top left */}
        <div
          style={{
            position: 'absolute',
            top: '4.5rem',
            left: '1rem',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            pointerEvents: 'none',
          }}
        >
          <StatChip label="Tracked"       value={satLoading ? '…' : satellites.length.toLocaleString()} color="var(--space-cyan)" />
          <StatChip label="Live Positions" value={filteredSatellites.length.toLocaleString()} color="var(--space-green)" />
          <StatChip label="Stream"         value={connected ? 'LIVE' : 'OFFLINE'} color={connected ? 'var(--space-green)' : 'var(--space-red)'} />
          {lastUpdate && <StatChip label="Updated" value={lastUpdate.toLocaleTimeString()} color="var(--space-text-muted)" />}
        </div>

        <Legend />

        {/* Reset camera button */}
        <button
          id="btn-reset-camera"
          aria-label="Reset camera view"
          onClick={onResetCamera}
          style={{
            position: 'absolute',
            bottom: '1.25rem',
            right: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.875rem',
            background: 'rgba(5,5,12,0.8)',
            border: '1px solid var(--space-border-bright)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--space-text-muted)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'all var(--transition-fast)',
            cursor: 'pointer',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--space-cyan)'
            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)'
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,255,0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--space-text-muted)'
            e.currentTarget.style.borderColor = 'var(--space-border-bright)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <ResetIcon />
          Reset Camera
        </button>
      </div>

      {/* ── Bottom 38%: StatsCards + SatelliteInfo + Charts ─────────────────── */}
      <div
        style={{
          flex: '0 0 38%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderTop: '1px solid var(--space-border)',
          background: 'var(--space-bg)',
        }}
      >
        <StatsCards stats={stats} />

        <div
          style={{
            flex: 1,
            padding: '0 1rem 1rem',
            minHeight: 0,
            display: 'flex',
            gap: '1rem',
            overflowY: 'auto',
          }}
        >
          {/* Info Card */}
          <div style={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column' }}>
            <SatelliteInfo noradId={selectedNoradId} />
          </div>

          {/* Charts Container */}
          <div
            style={{
              flex: '2 1 500px',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Altitude Chart */}
            <div
              className="card"
              style={{
                flex: '1 1 240px',
                padding: '12px 16px',
                background: 'var(--space-card, #0f0f1a)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--space-text-muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                Altitude Distribution
              </h3>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0 }}>
                <AltitudeChart satellites={filteredSatellites} />
              </div>
            </div>

            {/* Type Chart */}
            <div
              className="card"
              style={{
                flex: '1 1 240px',
                padding: '12px 16px',
                background: 'var(--space-card, #0f0f1a)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--space-text-muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                Type Breakdown
              </h3>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0 }}>
                <TypeDistribution satellites={filteredSatellites} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

GlobeView.propTypes = {
  onResetCamera: PropTypes.func.isRequired,
  controlsRef: PropTypes.object.isRequired,
  stats: PropTypes.object,
}

// ── AlertsView ────────────────────────────────────────────────────────────────

/**
 * Alerts mode: full-width AlertPanel + AlertDetail slide-out.
 *
 * @param {{ conjunctions: Object[] }} props
 */
function AlertsView({ conjunctions }) {
  const { activeAlert, setActiveAlert } = useAppContext()

  return (
    <div
      id="alerts-view"
      style={{
        height: 'calc(100vh - var(--header-height))',
        overflow: 'auto',
        padding: '1rem',
        background: 'var(--space-bg)',
      }}
    >
      <AlertPanel
        conjunctions={conjunctions}
        onSelect={(c) => setActiveAlert(c)}
      />

      {activeAlert && (
        <AlertDetail
          conjunction={activeAlert}
          onClose={() => setActiveAlert(null)}
        />
      )}
    </div>
  )
}

AlertsView.propTypes = {
  conjunctions: PropTypes.arrayOf(PropTypes.object).isRequired,
}

// ── App Root ──────────────────────────────────────────────────────────────────

/**
 * Inner app — rendered inside AppProvider so useAppContext works.
 */
function AppInner() {
  const controlsRef = useRef(null)
  const [stats, setStats]               = useState(/** @type {Object|null} */ (null))
  const [conjunctions, setConjunctions] = useState(/** @type {Object[]} */ ([]))

  const {
    pendingAlerts,
    clearPendingAlerts,
    setActiveAlert,
    setActiveNav,
  } = useAppContext()

  const handleResetCamera = useCallback(() => {
    controlsRef.current?.reset()
  }, [])

  // Fetch dashboard stats on mount
  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => console.error('[App] fetchStats error:', e))
  }, [])

  // Fetch conjunctions on mount
  useEffect(() => {
    fetchConjunctions()
      .then((data) => setConjunctions(Array.isArray(data) ? data : []))
      .catch((e) => console.error('[App] fetchConjunctions error:', e))
  }, [])

  // Limit notifications shown to max 3 at once
  const visibleAlerts = useMemo(() => pendingAlerts.slice(0, 3), [pendingAlerts])

  return (
    <>
      <MainLayout onResetCamera={handleResetCamera}>
        {({ activeView }) => {
          if (activeView === 'alerts') {
            return <AlertsView conjunctions={conjunctions} />
          }
          return (
            <GlobeView
              onResetCamera={handleResetCamera}
              controlsRef={controlsRef}
              stats={stats}
            />
          )
        }}
      </MainLayout>

      {/* Real-time Toast Notification Container */}
      {visibleAlerts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(var(--header-height) + 12px)',
            right: '16px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          {visibleAlerts.map((alert) => (
            <NotificationToast
              key={alert.id ?? alert.conjunction_id}
              alert={alert}
              onDismiss={() => clearPendingAlerts(alert.id ?? alert.conjunction_id)}
              onClick={() => {
                setActiveAlert(alert)
                setActiveNav('alerts')
                clearPendingAlerts(alert.id ?? alert.conjunction_id)
              }}
            />
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Root component — wraps the app in AppProvider.
 * @returns {JSX.Element}
 */
function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}

export default App
