/**
 * @fileoverview App.jsx — Root application component for OrbitalWatch.
 *
 * Integrates the ThreeGlobe 3D visualisation with the satellite catalogue
 * (useSatellites) and live position stream (useWebSocket).
 */

import { useState, useRef, useCallback } from 'react'
import { AppProvider } from './context/AppContext.jsx'
import MainLayout from './components/Layout/MainLayout.jsx'
import ThreeGlobe from './components/Globe/ThreeGlobe.jsx'
import useSatellites from './hooks/useSatellites.js'
import useWebSocket from './hooks/useWebSocket.js'
import './index.css'

// ── Reset Camera icon ─────────────────────────────────────────────────────────

const ResetIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

// ── GlobeDashboard ────────────────────────────────────────────────────────────

/**
 * The full-height dashboard containing the ThreeGlobe with live satellite data.
 *
 * @param {{ onResetCamera: Function, controlsRef: Object }} props
 * @returns {JSX.Element}
 */
function GlobeDashboard({ onResetCamera, controlsRef }) {
  const { satellites, loading: satLoading } = useSatellites()
  const { positions, connected, lastUpdate } = useWebSocket()
  const [selectedNoradId, setSelectedNoradId] = useState(/** @type {string|null} */ (null))

  /** Deselects on double-click of the canvas background */
  const handleSelect = useCallback((noradId) => {
    setSelectedNoradId((prev) => (prev === noradId ? null : noradId))
  }, [])

  // Find selected satellite metadata for the info panel
  const selectedSat = selectedNoradId
    ? satellites.find((s) => String(s.norad_id) === String(selectedNoradId)) ??
      positions.find((p) => String(p.norad_id) === String(selectedNoradId)) ??
      null
    : null

  const selectedPos = selectedNoradId
    ? positions.find((p) => String(p.norad_id) === String(selectedNoradId)) ?? null
    : null

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
      {/* ── Globe canvas (fills remaining height) ──────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ThreeGlobe
          satellites={satellites}
          positions={positions}
          selectedNoradId={selectedNoradId}
          onSelect={handleSelect}
          controlsRef={controlsRef}
        />

        {/* ── Overlay: Stats strip ─────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            pointerEvents: 'none',
          }}
        >
          <StatChip
            label="Tracked"
            value={satLoading ? '…' : satellites.length.toLocaleString()}
            color="var(--space-cyan)"
          />
          <StatChip
            label="Live Positions"
            value={positions.length.toLocaleString()}
            color="var(--space-green)"
          />
          <StatChip
            label="Stream"
            value={connected ? 'LIVE' : 'OFFLINE'}
            color={connected ? 'var(--space-green)' : 'var(--space-red)'}
          />
          {lastUpdate && (
            <StatChip
              label="Updated"
              value={lastUpdate.toLocaleTimeString()}
              color="var(--space-text-muted)"
            />
          )}
        </div>

        {/* ── Overlay: Selected satellite info panel ───────────────────── */}
        {selectedNoradId && (
          <SelectedPanel
            sat={selectedSat}
            pos={selectedPos}
            onClose={() => setSelectedNoradId(null)}
          />
        )}

        {/* ── Legend ───────────────────────────────────────────────────── */}
        <Legend />

        {/* ── Reset camera button ──────────────────────────────────────── */}
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
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * @param {{ label: string, value: string, color: string }} props
 */
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
      <span
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: '0.62rem',
          color: 'var(--space-text-dim)',
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginTop: 2,
        }}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * @param {{ sat: Object|null, pos: Object|null, onClose: Function }} props
 */
function SelectedPanel({ sat, pos, onClose }) {
  const name = sat?.name ?? pos?.norad_id ?? '—'
  const noradId = sat?.norad_id ?? pos?.norad_id ?? '—'
  const alt = pos?.altitude_km ?? pos?.altitude ?? sat?.altitude_km ?? null
  const vel = pos?.velocity_kms ?? pos?.velocity ?? null
  const type = sat?.object_type ?? sat?.type ?? '—'

  const typeColor =
    {
      payload: 'var(--space-green)',
      debris: 'var(--space-red)',
      'rocket body': 'var(--space-amber)',
    }[(type || '').toLowerCase()] ?? 'var(--space-text-muted)'

  return (
    <div
      id="selected-satellite-panel"
      style={{
        position: 'absolute',
        bottom: '1.25rem',
        left: '1.25rem',
        background: 'rgba(5,5,12,0.88)',
        border: '1px solid var(--space-cyan)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem',
        minWidth: 230,
        boxShadow: '0 0 30px rgba(0,212,255,0.15)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.2s ease forwards',
        zIndex: 10,
      }}
    >
      {/* Close button */}
      <button
        aria-label="Deselect satellite"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.75rem',
          color: 'var(--space-text-muted)',
          fontSize: '1rem',
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      <div
        className="gradient-text"
        style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '0.6rem' }}
      >
        SELECTED SATELLITE
      </div>

      <div
        style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: 'var(--space-text)',
          marginBottom: '0.5rem',
          wordBreak: 'break-word',
        }}
      >
        {name}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.75rem',
        }}
      >
        <InfoRow label="NORAD" value={`#${noradId}`} />
        <InfoRow
          label="TYPE"
          value={type}
          color={typeColor}
        />
        <InfoRow
          label="ALTITUDE"
          value={alt != null ? `${Number(alt).toFixed(0)} km` : '—'}
          color="var(--space-cyan)"
        />
        <InfoRow
          label="VELOCITY"
          value={vel != null ? `${Number(vel).toFixed(2)} km/s` : '—'}
          color="var(--space-amber)"
        />
      </div>
    </div>
  )
}

/**
 * @param {{ label: string, value: string, color?: string }} props
 */
function InfoRow({ label, value, color = 'var(--space-text)' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
      <span style={{ color: 'var(--space-text-muted)' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

/** Colour legend for satellite types */
function Legend() {
  const items = [
    { label: 'Payload', color: '#00ff9d' },
    { label: 'Debris', color: '#ff4d4d' },
    { label: 'Rocket Body', color: '#ff9d00' },
    { label: 'Unknown', color: '#888888' },
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
      <div
        style={{
          fontSize: '0.62rem',
          color: 'var(--space-text-dim)',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '0.15rem',
        }}
      >
        Legend
      </div>
      {items.map(({ label, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--space-text-muted)' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── App Root ──────────────────────────────────────────────────────────────────

/**
 * Root application component. Wraps the entire app in AppProvider context
 * and renders the MainLayout shell with the live 3D globe dashboard.
 *
 * @returns {JSX.Element}
 */
function App() {
  // Ref to OrbitControls so App-level "Reset Camera" button can call reset()
  const controlsRef = useRef(null)

  const handleResetCamera = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.reset()
  }, [])

  return (
    <AppProvider>
      <MainLayout onResetCamera={handleResetCamera}>
        <GlobeDashboard onResetCamera={handleResetCamera} controlsRef={controlsRef} />
      </MainLayout>
    </AppProvider>
  )
}

export default App
