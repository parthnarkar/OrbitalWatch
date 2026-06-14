/**
 * @fileoverview App.jsx — Root application component for OrbitalWatch.
 * Redesigned: full-screen globe, floating left filter panel,
 * top-right camera controls, bottom stats bar.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
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
import { useKeyboardShortcuts, SHORTCUTS } from './components/Layout/KeyboardShortcuts.jsx'

import useSatellites from './hooks/useSatellites.js'
import { fetchStats, fetchConjunctions, wakeUpBackend } from './services/api.js'
import RescanButton from './components/Dashboard/RescanButton.jsx'
import LaunchSimulatorPanel from './components/Dashboard/LaunchSimulatorPanel.jsx'
import './index.css'

// ── Satellite type color map ──────────────────────────────────────────────────

const TYPE_COLORS = {
  payload:      '#00ff9d',
  debris:       '#ff4d4d',
  'rocket body': '#ff9d00',
  unknown:      '#888888',
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────



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
 * @param {{ stats: Object, filters: Object, onChange: Function, satellites: Array, shortcutsOpen: boolean, setShortcutsOpen: Function, filtersOpen: boolean, setFiltersOpen: Function, legendOpen: boolean, setLegendOpen: Function }} props
 */
function FloatingFilterPanel({
  stats,
  filters,
  onChange,
  satellites,
  shortcutsOpen,
  setShortcutsOpen,
  filtersOpen,
  setFiltersOpen,
  legendOpen,
  setLegendOpen,
}) {

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

  const panelStyle = {
    background: 'rgba(10,10,18,0.88)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '14px',
    border: '1px solid #1a1a2e',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    pointerEvents: 'auto',
    width: '100%',
  }

  return (
    <div
      id="floating-filter-panel"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* ── Shortcuts Section ── */}
      <div style={panelStyle}>
        <button
          onClick={() => setShortcutsOpen(!shortcutsOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.625rem 0.875rem',
            background: 'rgba(255,255,255,0.03)',
            border: 'none',
            borderBottom: shortcutsOpen ? '1px solid #1a1a2e' : 'none',
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
            <span style={{ fontSize: '0.85rem' }}>⌨️</span>
            Shortcuts
          </span>
          <span style={{ opacity: 0.6, transform: shortcutsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
            <ChevronDown />
          </span>
        </button>

        {shortcutsOpen && (
          <div
            style={{
              padding: '0.5rem 0.875rem 0.625rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              maxHeight: '180px',
              overflowY: 'auto',
            }}
          >
            {SHORTCUTS.map(({ key, description }) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.3rem 0',
                  borderBottom: '1px solid rgba(26,26,46,0.5)',
                }}
              >
                <span style={{ fontSize: '0.72rem', color: '#8888aa' }}>{description}</span>
                <kbd
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 26,
                    padding: '0.1rem 0.35rem',
                    background: 'rgba(0,212,255,0.08)',
                    border: '1px solid rgba(0,212,255,0.25)',
                    borderRadius: 4,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: '#00d4ff',
                  }}
                >
                  {key === 'Escape' ? 'Esc' : key}
                </kbd>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filters Section ── */}
      <div style={panelStyle}>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
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

        {filtersOpen && (
          <div style={{ padding: '0.5rem 0', maxHeight: '180px', overflowY: 'auto' }}>
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
      </div>

      {/* ── Legend Section ── */}
      <div style={panelStyle}>
        <button
          onClick={() => setLegendOpen(!legendOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.625rem 0.875rem',
            background: 'rgba(255,255,255,0.03)',
            border: 'none',
            borderBottom: legendOpen ? '1px solid #1a1a2e' : 'none',
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
            <span style={{ fontSize: '0.85rem' }}>📊</span>
            Legend
          </span>
          <span style={{ opacity: 0.6, transform: legendOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
            <ChevronDown />
          </span>
        </button>

        {legendOpen && (
          <div style={{ padding: '0.5rem 0.875rem 0.625rem', maxHeight: '180px', overflowY: 'auto' }}>
            {[
              { label: 'Payload',      color: '#00ff9d', desc: 'Active satellites' },
              { label: 'Debris',       color: '#ff4d4d', desc: 'Space debris' },
              { label: 'Rocket Body',  color: '#ff9d00', desc: 'Rocket stages' },
              { label: 'Unknown',      color: '#888888', desc: 'Unclassified' },
            ].map(({ label, color, desc }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
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
    </div>
  )
}

FloatingFilterPanel.propTypes = {
  stats:      PropTypes.object,
  filters:    PropTypes.object.isRequired,
  onChange:   PropTypes.func.isRequired,
  satellites: PropTypes.array.isRequired,
  openSection: PropTypes.string.isRequired,
  setOpenSection: PropTypes.func.isRequired,
}

FloatingFilterPanel.defaultProps = { stats: null }

// ── Top-Right Camera Controls ─────────────────────────────────────────────────

function CameraControls({ onReset, onRescan }) {
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
      <button
        id="btn-reset-all"
        aria-label="Reset and refresh all data"
        title="Reset and refresh all data"
        onClick={onReset}
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
        <ResetIcon />
        <span style={{ fontSize: '0.48rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, lineHeight: 1, marginTop: 2 }}>
          Reset
        </span>
      </button>

      {/* Rescan button — fetch fresh TLE data from CelesTrak */}
      <RescanButton onRescanComplete={onRescan} />
    </div>
  )
}

CameraControls.propTypes = {
  onReset:  PropTypes.func.isRequired,
  onRescan: PropTypes.func,
}

CameraControls.defaultProps = { onRescan: null }

// ── GlobeView ─────────────────────────────────────────────────────────────────

/**
 * Full-screen globe view with floating panels.
 */
function GlobeView({ onResetAll, onRescan, controlsRef, stats, satellites }) {
  const {
    filteredSatellites,
    filters,
    setFilters,
    selectedSatellite,
    setSelectedSatellite,
    simOpen,
    simParams,
    simResult,
    simLaunched,
    focusedConjunction,
    setFocusedConjunction,
  } = useAppContext()

  const [selectedNoradId, setSelectedNoradId] = useState(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [legendOpen, setLegendOpen] = useState(false)
  const [satelliteOpen, setSatelliteOpen] = useState(true)

  // Auto-expand satellite info when a new satellite is selected
  useEffect(() => {
    if (selectedNoradId) {
      setSatelliteOpen(true)
    } else {
      setSatelliteOpen(false)
    }
  }, [selectedNoradId])

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
      return satellites.find((s) => String(s.norad_id) === String(noradId)) ?? null
    })
  }, [satellites, setSelectedSatellite])

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
        const sat = satellites.find((s) => String(s.norad_id) === String(norad1))
        setSelectedSatellite(sat ?? null)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('ow:demo-select-satellite'))
        }, 150)
      }
    }
    window.addEventListener('ow:focus-conjunction', handler)
    return () => window.removeEventListener('ow:focus-conjunction', handler)
  }, [satellites, setSelectedSatellite])

  // Listen for global event to open shortcuts collapsible panel in the sidebar
  useEffect(() => {
    const handler = () => {
      setShortcutsOpen(true)
      // scroll left control deck to top
      const deck = document.getElementById('left-control-deck')
      if (deck) deck.scrollTop = 0
    }
    window.addEventListener('ow:open-shortcuts', handler)
    return () => window.removeEventListener('ow:open-shortcuts', handler)
  }, [])

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
      {/* ── Globe Workspace (keeps floating panels inside globe boundary) ────────── */}
      <div
        id="globe-workspace"
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
        }}
      >
        {focusedConjunction && (
          <div
            id="focused-conjunction-banner"
            style={{
              position: 'absolute',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 77, 77, 0.15)',
              border: '1px solid rgba(255, 77, 77, 0.4)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '999px',
              padding: '8px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              zIndex: 100,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(255, 77, 77, 0.15)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', animation: 'pulse-dot 1.5s infinite' }}>⚠️</span>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#ff4d4d', textTransform: 'uppercase' }}>
                Conjunction Focus Mode
              </span>
            </div>
            <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ fontSize: '11px', color: '#e8e8f0', fontWeight: 500 }}>
              {focusedConjunction.sat1_name ?? focusedConjunction.satellite1_name ?? 'Sat A'} + {focusedConjunction.sat2_name ?? focusedConjunction.satellite2_name ?? 'Sat B'}
            </span>
            <button
              onClick={() => setFocusedConjunction(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                borderRadius: '999px',
                padding: '4px 12px',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ff4d4d'
                e.currentTarget.style.borderColor = '#ff4d4d'
                e.currentTarget.style.color = '#000000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                e.currentTarget.style.color = '#ffffff'
              }}
            >
              Exit Focus
            </button>
          </div>
        )}

        {/* ── Full-screen Globe ──────────────────────────────────────────────────── */}
        <div className="globe-container">
          <ErrorBoundary label="3D Globe">
            <ThreeGlobe
              satellites={satellites}
              positions={filteredSatellites}
              selectedNoradId={selectedNoradId}
              onSelect={handleSelect}
              controlsRef={controlsRef}
              proposedOrbit={simOpen ? simParams : null}
              simulationResult={simResult}
              simLaunched={simLaunched}
            />
          </ErrorBoundary>

          {/* Top-right camera controls */}
          <CameraControls
            onReset={onResetAll}
            onRescan={onRescan}
          />
        </div>

        {/* ── Left Control Deck (Filters, Legend, Satellite Info) ────────────────── */}
        <div
          id="left-control-deck"
          style={{
            position: 'absolute',
            left: 24,
            top: 24,
            bottom: 24,
            width: 280,
            display: simOpen ? 'none' : 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 40,
            overflowY: 'auto',
            pointerEvents: 'none',
            scrollbarWidth: 'none', /* Firefox */
          }}
        >
          <FloatingFilterPanel
            stats={stats}
            filters={filters}
            onChange={setFilters}
            satellites={filteredSatellites}
            shortcutsOpen={shortcutsOpen}
            setShortcutsOpen={setShortcutsOpen}
            filtersOpen={filtersOpen}
            setFiltersOpen={setFiltersOpen}
            legendOpen={legendOpen}
            setLegendOpen={setLegendOpen}
          />

          {selectedNoradId && (
            <SatelliteInfo
              noradId={selectedNoradId}
              isOpen={satelliteOpen}
              onToggle={() => setSatelliteOpen(!satelliteOpen)}
            />
          )}
        </div>

        {/* Launch Simulator Panel */}
        <LaunchSimulatorPanel satellites={satellites} />

        {/* Charts — bottom-right, only shown when satellite selected */}
        {selectedNoradId && (
          <div
            id="selected-satellite-charts"
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
  onResetAll:    PropTypes.func.isRequired,
  onRescan:      PropTypes.func,
  controlsRef:   PropTypes.object.isRequired,
  stats:         PropTypes.object,
  satellites:    PropTypes.array.isRequired,
}

GlobeView.defaultProps = { onRescan: null }

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
        overflowY: 'auto',
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
  const {
    setActiveNav,
    setSelectedSatellite,
    setActiveAlert,
    setFilters,
    setShowDebrisOnly,
    alerts: liveAlerts,
    connected,
    setSimOpen,
    setSimParams,
    setFocusedConjunction,
  } = useAppContext()

  const [backendReady, setBackendReady] = useState(false)
  const [wakeAttempt, setWakeAttempt]   = useState(0)
  const { enabled: demoEnabled, toggle: toggleDemo } = useDemoMode()
  const { satellites, refetch: refetchSatellites } = useSatellites()

  useKeyboardShortcuts({
    onToggleDemoMode: toggleDemo,
    onOpenShortcuts: () => {
      setActiveNav('dashboard')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('ow:open-shortcuts'))
      }, 50)
    }
  })

  const handleResetAll = useCallback(() => {
    // 1. Reset Camera
    controlsRef.current?.reset()
    window.dispatchEvent(new CustomEvent('ow:reset-camera'))

    // 2. Clear selections
    setSelectedSatellite(null)
    setActiveAlert(null)
    setFocusedConjunction(null)

    // 3. Reset filters
    setFilters({
      types: ['payload', 'debris', 'rocket body', 'unknown'],
      minAltitude: 0,
      maxAltitude: 40000,
    })
    setShowDebrisOnly(false)

    // 4. Refresh API data
    refetchSatellites()
    fetchStats()
      .then(setStats)
      .catch((e) => console.error('[App] fetchStats error:', e))
    fetchConjunctions()
      .then((data) => setConjunctions(Array.isArray(data) ? data : []))
      .catch((e) => console.error('[App] fetchConjunctions error:', e))
  }, [setSelectedSatellite, setActiveAlert, setFocusedConjunction, setFilters, setShowDebrisOnly, refetchSatellites])

  /**
   * Called by RescanButton after a successful CelesTrak fetch.
   * Re-fetches the satellite catalogue and stats so the globe/counts update.
   */
  const handleRescanComplete = useCallback(() => {
    refetchSatellites()
    fetchStats()
      .then(setStats)
      .catch((e) => console.error('[App] post-rescan fetchStats error:', e))
  }, [refetchSatellites])

  // Parse URL configuration parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const simParam = params.get('sim')
    if (simParam) {
      setActiveNav('dashboard')
      setSimOpen(true)
      if (simParam === 'phoenix-1') {
        setSimParams({
          name: 'Phoenix-1',
          launchSite: 'Cape Canaveral',
          altitudeKm: 600,
          inclination: 53.0,
          eccentricity: 0.0001,
          raan: 120,
          payloadMass: 650,
          durationYears: 5,
          deorbitStrategy: 'Active'
        })
      } else if (simParam === 'aurora-2') {
        setSimParams({
          name: 'Aurora-2',
          launchSite: 'Vandenberg',
          altitudeKm: 800,
          inclination: 98.2,
          eccentricity: 0.0002,
          raan: 270,
          payloadMass: 400,
          durationYears: 8,
          deorbitStrategy: 'Passive'
        })
      }
    }
  }, [setActiveNav, setSimOpen, setSimParams])

  // ── Backend wake-up + initial data load ─────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function boot() {
      const ready = await wakeUpBackend({
        maxAttempts: 20,
        intervalMs: 4_000,
        onAttempt: (n) => { if (!cancelled) setWakeAttempt(n) },
      })
      if (cancelled) return
      setBackendReady(ready)
      if (!ready) return
      // Fire all initial fetches in parallel once backend is awake
      Promise.all([
        fetchStats().then(setStats).catch((e) => console.error('[App] fetchStats error:', e)),
        fetchConjunctions()
          .then((data) => setConjunctions(Array.isArray(data) ? data : []))
          .catch((e) => console.error('[App] fetchConjunctions error:', e)),
      ])
    }
    boot()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch and sync data once WebSocket connection is established
  useEffect(() => {
    if (connected) {
      fetchStats()
        .then(setStats)
        .catch((e) => console.error('[App] sync fetchStats error:', e))
      fetchConjunctions()
        .then((data) => setConjunctions(Array.isArray(data) ? data : []))
        .catch((e) => console.error('[App] sync fetchConjunctions error:', e))
      refetchSatellites()
    }
  }, [connected, refetchSatellites])

  // Merge live WebSocket alerts with static historical conjunctions
  const mergedConjunctions = useMemo(() => {
    const map = new Map()
    conjunctions.forEach((c) => {
      const id = c.id ?? c.conjunction_id
      if (id != null) map.set(String(id), c)
    })
    liveAlerts.forEach((a) => {
      const id = a.id ?? a.conjunction_id
      if (id != null) map.set(String(id), a)
    })
    return Array.from(map.values()).sort((a, b) => {
      const ta = new Date(a.approach_time ?? a.tca ?? 0).getTime()
      const tb = new Date(b.approach_time ?? b.tca ?? 0).getTime()
      return tb - ta
    })
  }, [conjunctions, liveAlerts])

  return (
    <>
      {/* ── Backend connecting overlay ─────────────────────────────────────── */}
      {!backendReady && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#080810',
            gap: '1.5rem',
          }}
        >
          {/* Pulsing orbit ring */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: '#00d4ff',
            borderRightColor: 'rgba(0,212,255,0.3)',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#00d4ff', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
              Connecting to OrbitalWatch Backend
            </p>
            <p style={{ color: '#5a5a80', fontSize: '0.78rem', margin: '0.4rem 0 0' }}>
              {wakeAttempt > 1
                ? `Waking up server… attempt ${wakeAttempt} of 20`
                : 'Establishing connection…'}
            </p>
          </div>
          <p style={{ color: '#3a3a5a', fontSize: '0.68rem', margin: 0 }}>
            Free-tier backends may take up to 60 seconds to wake up
          </p>
        </div>
      )}

      <MainLayout demoEnabled={demoEnabled} onToggleDemo={toggleDemo}>
        {({ activeView }) => {
          if (activeView === 'alerts') {
            return <AlertsView conjunctions={mergedConjunctions} />
          }
          return (
            <GlobeView
              onResetAll={handleResetAll}
              onRescan={handleRescanComplete}
              controlsRef={controlsRef}
              stats={stats}
              satellites={satellites}
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
