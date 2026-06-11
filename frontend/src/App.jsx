/**
 * @fileoverview App.jsx — Root application component for OrbitalWatch.
 * Redesigned: full-screen globe, floating left filter panel,
 * top-right camera controls, bottom stats bar.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'
import { AppProvider, useAppContext } from './context/AppContext.jsx'
import MainLayout from './components/Layout/MainLayout.jsx'
import ThreeGlobe from './components/Globe/ThreeGlobe.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Dashboard components
import SatelliteInfo    from './components/Dashboard/SatelliteInfo.jsx'
import StatsCards       from './components/Dashboard/StatsCards.jsx'
import AlertPanel       from './components/Dashboard/AlertPanel.jsx'
import AlertDetail      from './components/Dashboard/AlertDetail.jsx'
import AltitudeChart    from './components/Dashboard/AltitudeChart.jsx'
import TypeDistribution from './components/Dashboard/TypeDistribution.jsx'
import DemoMode, { useDemoMode } from './components/Dashboard/DemoMode.jsx'

import useSatellites from './hooks/useSatellites.js'
import { fetchStats, fetchConjunctions } from './services/api.js'
import './index.css'

// ── Satellite type color map ──────────────────────────────────────────────────

const TYPE_COLORS = {
  payload:      '#00ff9d',
  debris:       '#ff4d4d',
  'rocket body': '#ff9d00',
  unknown:      '#888888',
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const TargetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="7" />
    <line x1="12" y1="17" x2="12" y2="22" />
    <line x1="2" y1="12" x2="7" y2="12" />
    <line x1="17" y1="12" x2="22" y2="12" />
  </svg>
)

const ResetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

// ── Floating Left Panel (Filters + Legend) ────────────────────────────────────

/**
 * @param {{ stats: Object, filters: Object, onChange: Function, satellites: Array }} props
 */
function FloatingFilterPanel({ stats, filters, onChange, satellites }) {
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [legendOpen, setLegendOpen] = useState(false)

  const ALL_TYPES = ['payload', 'debris', 'rocket body', 'unknown']

  const activeTypes = filters?.types ?? ALL_TYPES

  const handleTypeToggle = (type) => {
    const next = activeTypes.includes(type)
      ? activeTypes.filter((t) => t !== type)
      : [...activeTypes, type]
    onChange({ ...filters, types: next })
  }

  // Count satellites per type from live positions
  const counts = {}
  ALL_TYPES.forEach((t) => {
    counts[t] = satellites.filter((s) => {
      const type = (s.type || s.object_type || 'unknown').toLowerCase().replace('rocket_body', 'rocket body')
      return type === t
    }).length
  })

  // Fall back to stats API counts if live counts are 0
  const totalFromStats = stats?.total_satellites ?? stats?.total ?? 0
  const debrisFromStats = stats?.debris_count ?? stats?.total_debris ?? stats?.debris ?? 0
  const totalLive = satellites.length

  // Use API-derived counts when available but live data is minimal
  const getCount = (type) => {
    if (totalLive > 10) return counts[type]
    if (type === 'debris') return debrisFromStats
    return counts[type]
  }

  return (
    <div
      id="floating-filter-panel"
      style={{
        position: 'absolute',
        left: 24,
        top: 80,
        width: 180,
        background: 'rgba(10,10,18,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '14px',
        border: '1px solid #1a1a2e',
        overflow: 'hidden',
        zIndex: 40,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* Filters header button */}
      <button
        onClick={() => setFiltersOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 0.875rem',
          background: 'rgba(255,255,255,0.03)',
          border: 'none',
          borderBottom: filtersOpen ? '1px solid #1a1a2e' : 'none',
          color: '#e8e8f0',
          fontSize: '0.8rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          transition: 'background 150ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem' }}>⚙</span>
          Filters
        </span>
        <span style={{ opacity: 0.6, transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
          <ChevronDown />
        </span>
      </button>

      {/* Type list */}
      {filtersOpen && (
        <div style={{ padding: '0.5rem 0' }}>
          {ALL_TYPES.map((type) => {
            const isActive = activeTypes.includes(type)
            const color = TYPE_COLORS[type]
            const count = getCount(type)
            const label = type === 'rocket body' ? 'Rocket Body' : type.charAt(0).toUpperCase() + type.slice(1)
            return (
              <button
                key={type}
                onClick={() => handleTypeToggle(type)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.875rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.38,
                  transition: 'opacity 150ms ease, background 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                title={`${isActive ? 'Hide' : 'Show'} ${label}`}
              >
                {/* Colored dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    boxShadow: isActive ? `0 0 6px ${color}` : 'none',
                    flexShrink: 0,
                    transition: 'box-shadow 150ms ease',
                  }}
                />
                <span style={{ flex: 1, textAlign: 'left', fontSize: '0.78rem', color: '#e8e8f0', fontWeight: 500 }}>
                  {label}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#5a5a80', fontVariantNumeric: 'tabular-nums' }}>
                  {count > 0 ? count.toLocaleString() : '—'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* View Legend toggle */}
      <button
        onClick={() => setLegendOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.55rem 0.875rem',
          background: 'rgba(255,255,255,0.02)',
          border: 'none',
          borderTop: '1px solid #1a1a2e',
          color: '#8a8ab0',
          fontSize: '0.75rem',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 150ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      >
        <span>View Legend</span>
        <span style={{ opacity: 0.6, transform: legendOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
          <ChevronDown />
        </span>
      </button>

      {/* Legend dropdown */}
      {legendOpen && (
        <div style={{ padding: '0.5rem 0.875rem 0.625rem', borderTop: '1px solid #1a1a2e' }}>
          {[
            { label: 'Payload',      color: '#00ff9d', desc: 'Active satellites' },
            { label: 'Debris',       color: '#ff4d4d', desc: 'Space debris' },
            { label: 'Rocket Body',  color: '#ff9d00', desc: 'Rocket stages' },
            { label: 'Unknown',      color: '#888888', desc: 'Unclassified' },
          ].map(({ label, color, desc }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.72rem', color: '#e8e8f0', fontWeight: 500, lineHeight: 1.2 }}>{label}</span>
                <span style={{ fontSize: '0.62rem', color: '#5a5a80' }}>{desc}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

FloatingFilterPanel.propTypes = {
  stats:      PropTypes.object,
  filters:    PropTypes.object.isRequired,
  onChange:   PropTypes.func.isRequired,
  satellites: PropTypes.array.isRequired,
}

FloatingFilterPanel.defaultProps = { stats: null }

// ── Top-Right Camera Controls ─────────────────────────────────────────────────

function CameraControls({ onCenter, onReset }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 24,
        top: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        zIndex: 40,
      }}
    >
      {[
        { id: 'btn-center-camera', label: 'Center on satellite', icon: <TargetIcon />, onClick: onCenter, title: 'Center' },
        { id: 'btn-reset-camera',  label: 'Reset camera view',   icon: <ResetIcon />,  onClick: onReset,  title: 'Reset'  },
      ].map(({ id, label, icon, onClick, title }) => (
        <button
          key={id}
          id={id}
          aria-label={label}
          title={label}
          onClick={onClick}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f0f1a',
            border: '1px solid #1a1a2e',
            color: '#8a8ab0',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            gap: '0.1rem',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1a1a2e'
            e.currentTarget.style.color = '#e8e8f0'
            e.currentTarget.style.borderColor = '#2a2a4a'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#0f0f1a'
            e.currentTarget.style.color = '#8a8ab0'
            e.currentTarget.style.borderColor = '#1a1a2e'
          }}
        >
          {icon}
          <span style={{ fontSize: '0.48rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, lineHeight: 1, marginTop: 2 }}>
            {title}
          </span>
        </button>
      ))}
    </div>
  )
}

CameraControls.propTypes = {
  onCenter: PropTypes.func.isRequired,
  onReset:  PropTypes.func.isRequired,
}

// ── GlobeView ─────────────────────────────────────────────────────────────────

/**
 * Full-screen globe view with floating panels.
 */
function GlobeView({ onResetCamera, controlsRef, stats }) {
  const { satellites: allSatellites, loading: satLoading } = useSatellites()
  const {
    filteredSatellites,
    filters,
    setFilters,
    selectedSatellite,
    setSelectedSatellite,
  } = useAppContext()

  const [selectedNoradId, setSelectedNoradId] = useState(null)

  // Sync selectedNoradId when selectedSatellite changes in context (e.g. from SearchBar in Header)
  useEffect(() => {
    if (selectedSatellite) {
      setSelectedNoradId(String(selectedSatellite.norad_id))
    } else {
      setSelectedNoradId(null)
    }
  }, [selectedSatellite])

  const handleSelect = useCallback((noradId) => {
    setSelectedSatellite((prev) => {
      if (prev && String(prev.norad_id) === String(noradId)) {
        return null
      }
      return allSatellites.find((s) => String(s.norad_id) === String(noradId)) ?? null
    })
  }, [allSatellites, setSelectedSatellite])

  const handleCenter = useCallback(() => {
    if (selectedNoradId && controlsRef.current) {
      window.dispatchEvent(new CustomEvent('ow:follow-satellite'))
    }
  }, [selectedNoradId, controlsRef])

  // Listen for 3D preview event from AlertDetail
  useEffect(() => {
    const handler = (e) => {
      const { norad1 } = e.detail ?? {}
      if (norad1) {
        const sat = allSatellites.find((s) => String(s.norad_id) === String(norad1))
        setSelectedSatellite(sat ?? null)
      }
    }
    window.addEventListener('ow:focus-conjunction', handler)
    return () => window.removeEventListener('ow:focus-conjunction', handler)
  }, [allSatellites, setSelectedSatellite])

  return (
    <div
      id="globe-dashboard"
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* ── Full-screen Globe ──────────────────────────────────────────────────── */}
      <div className="globe-container">
        <ErrorBoundary label="3D Globe">
          <ThreeGlobe
            satellites={allSatellites}
            positions={filteredSatellites}
            selectedNoradId={selectedNoradId}
            onSelect={handleSelect}
            controlsRef={controlsRef}
          />
        </ErrorBoundary>

        {/* Floating left panel — filters */}
        <FloatingFilterPanel
          stats={stats}
          filters={filters}
          onChange={setFilters}
          satellites={filteredSatellites}
        />

        {/* Top-right camera controls */}
        <CameraControls
          onCenter={handleCenter}
          onReset={onResetCamera}
        />

        {/* SatelliteInfo — bottom-left when a satellite is selected */}
        {selectedNoradId && (
          <div
            style={{
              position: 'absolute',
              bottom: '1.25rem',
              left: 24,
              width: 280,
              zIndex: 20,
              maxHeight: '45vh',
              overflowY: 'auto',
            }}
          >
            <SatelliteInfo noradId={selectedNoradId} />
          </div>
        )}

        {/* Charts — bottom-right, only shown when satellite selected */}
        {selectedNoradId && (
          <div
            style={{
              position: 'absolute',
              bottom: '1.25rem',
              right: 24,
              display: 'flex',
              gap: '0.75rem',
              zIndex: 20,
              maxWidth: 480,
            }}
          >
            <div
              className="card"
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'rgba(10,10,18,0.88)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                minWidth: 200,
              }}
            >
              <h3 style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#8a8ab0', marginBottom: 8, letterSpacing: '0.07em' }}>
                Altitude Distribution
              </h3>
              <AltitudeChart satellites={filteredSatellites} />
            </div>
            <div
              className="card"
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'rgba(10,10,18,0.88)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                minWidth: 200,
              }}
            >
              <h3 style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#8a8ab0', marginBottom: 8, letterSpacing: '0.07em' }}>
                Type Breakdown
              </h3>
              <TypeDistribution satellites={filteredSatellites} />
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Bar (bottom) ──────────────────────────────────────────────────── */}
      <StatsCards stats={stats} />
    </div>
  )
}

GlobeView.propTypes = {
  onResetCamera: PropTypes.func.isRequired,
  controlsRef:   PropTypes.object.isRequired,
  stats:         PropTypes.object,
}

// ── AlertsView ────────────────────────────────────────────────────────────────

function AlertsView({ conjunctions }) {
  const { activeAlert, setActiveAlert } = useAppContext()

  return (
    <div
      id="alerts-view"
      style={{
        padding: '1rem',
        background: 'var(--space-bg)',
        width: '100%',
        flex: 1,
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

function AppInner() {
  const controlsRef = useRef(null)
  const [stats, setStats]               = useState(null)
  const [conjunctions, setConjunctions] = useState([])

  const { enabled: demoEnabled, toggle: toggleDemo } = useDemoMode()
  const { satellites } = useSatellites()

  const handleResetCamera = useCallback(() => {
    controlsRef.current?.reset()
  }, [])

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => console.error('[App] fetchStats error:', e))
  }, [])

  useEffect(() => {
    fetchConjunctions()
      .then((data) => setConjunctions(Array.isArray(data) ? data : []))
      .catch((e) => console.error('[App] fetchConjunctions error:', e))
  }, [])

  return (
    <>
      <MainLayout demoEnabled={demoEnabled} onToggleDemo={toggleDemo}>
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

      <DemoMode
        enabled={demoEnabled}
        onToggle={toggleDemo}
        satellites={satellites}
        conjunctions={conjunctions}
      />
    </>
  )
}

function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}

export default App
