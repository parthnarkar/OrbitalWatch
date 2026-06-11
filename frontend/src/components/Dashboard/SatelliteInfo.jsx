/**
 * @fileoverview SatelliteInfo — detail panel for a selected satellite.
 * Fetches full satellite data via fetchSatellite() when noradId changes.
 */

import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { fetchSatellite } from '../../services/api.js'

// ── Utilities ─────────────────────────────────────────────────────────────────

/** @param {string} type */
function typeColor(type) {
  const t = (type || '').toLowerCase()
  if (t === 'payload')      return { bg: 'rgba(0,255,157,0.15)', color: '#00ff9d', border: 'rgba(0,255,157,0.3)' }
  if (t === 'debris')       return { bg: 'rgba(255,68,102,0.15)', color: '#ff4466', border: 'rgba(255,68,102,0.3)' }
  if (t === 'rocket body')  return { bg: 'rgba(255,187,51,0.15)', color: '#ffbb33', border: 'rgba(255,187,51,0.3)' }
  return { bg: 'rgba(136,136,170,0.15)', color: '#8888aa', border: 'rgba(136,136,170,0.3)' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Shimmer skeleton bar */
function SkeletonBar({ width = '100%', height = 18 }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 6, marginBottom: 8 }}
    />
  )
}
SkeletonBar.propTypes = { width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), height: PropTypes.number }

/** Stat grid cell */
function StatCell({ label, value, color = 'var(--space-text)' }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--space-border)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
      }}
    >
      <div style={{ fontSize: '0.65rem', color: 'var(--space-text-dim)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
        {value ?? '—'}
      </div>
    </div>
  )
}
StatCell.propTypes = { label: PropTypes.string, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), color: PropTypes.string }

// ── TLE Collapsible ────────────────────────────────────────────────────────────

/** @param {{ tle1: string, tle2: string }} props */
function TLESection({ tle1, tle2 }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = `${tle1}\n${tle2}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [tle1, tle2])

  if (!tle1 && !tle2) return null

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--space-border)', paddingTop: '0.75rem' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--space-text-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          width: '100%',
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        <span style={{ transition: 'transform var(--transition-fast)', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        TLE Data
        {open && (
          <span
            onClick={(e) => { e.stopPropagation(); handleCopy() }}
            style={{
              marginLeft: 'auto',
              fontSize: '0.65rem',
              padding: '0.2rem 0.6rem',
              borderRadius: 999,
              background: copied ? 'rgba(0,255,157,0.15)' : 'rgba(0,212,255,0.1)',
              color: copied ? '#00ff9d' : 'var(--space-cyan)',
              border: `1px solid ${copied ? 'rgba(0,255,157,0.3)' : 'rgba(0,212,255,0.2)'}`,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            marginTop: '0.625rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.68rem',
            color: 'var(--space-text-muted)',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--space-border)',
            borderRadius: 6,
            padding: '0.625rem 0.75rem',
            overflowX: 'auto',
            lineHeight: 1.8,
          }}
        >
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={tle1}>{tle1}</div>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={tle2}>{tle2}</div>
        </div>
      )}
    </div>
  )
}
TLESection.propTypes = { tle1: PropTypes.string, tle2: PropTypes.string }

// ── SatelliteInfo Component ────────────────────────────────────────────────────

/**
 * Displays detailed information for a single satellite.
 * Fetches data from the API when `noradId` changes.
 *
 * @param {{ noradId: string | null }} props
 * @returns {JSX.Element}
 */
function SatelliteInfo({ noradId }) {
  const [satellite, setSatellite] = useState(/** @type {Object|null} */ (null))
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(/** @type {string|null} */ (null))

  useEffect(() => {
    if (!noradId) {
      setSatellite(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setSatellite(null)

    fetchSatellite(noradId)
      .then((data) => {
        if (!cancelled) setSatellite(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load satellite data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [noradId])

  const cardStyle = {
    background: '#0f0f1a',
    border: '1px solid var(--space-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    minHeight: '200px',
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!noradId) {
    return (
      <div id="satellite-info-panel" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minHeight: 200 }}>
        <div style={{ fontSize: '2rem', opacity: 0.3 }}>🛰️</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--space-text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          Select a satellite on the globe to view details
        </p>
      </div>
    )
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div id="satellite-info-panel" style={cardStyle}>
        <SkeletonBar height={24} width="60%" />
        <SkeletonBar height={14} width="30%" />
        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <SkeletonBar height={60} />
          <SkeletonBar height={60} />
          <SkeletonBar height={60} />
          <SkeletonBar height={60} />
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div id="satellite-info-panel" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: 200 }}>
        <div style={{ fontSize: '1.5rem' }}>⚠️</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--space-red)', textAlign: 'center' }}>{error}</p>
      </div>
    )
  }

  if (!satellite) return null

  const tc = typeColor(satellite.object_type ?? satellite.type)
  const altitude = satellite.altitude_km ?? satellite.altitude
  const velocity = satellite.velocity_kms ?? satellite.velocity
  const period   = satellite.period ?? satellite.orbital_period ?? satellite.orbital_period_min

  return (
    <div id="satellite-info-panel" style={cardStyle}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--space-text)',
            marginBottom: '0.3rem',
            wordBreak: 'break-word',
          }}
        >
          {satellite.name ?? `NORAD ${noradId}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.8rem',
              color: 'var(--space-cyan)',
              fontWeight: 600,
            }}
          >
            #{satellite.norad_id ?? noradId}
          </span>
          {(satellite.object_type || satellite.type) && (
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '0.15rem 0.5rem',
                borderRadius: 999,
                background: tc.bg,
                color: tc.color,
                border: `1px solid ${tc.border}`,
              }}
            >
              {satellite.object_type ?? satellite.type}
            </span>
          )}
        </div>
      </div>

      {/* ── Stats grid ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
        <StatCell
          label="Altitude"
          value={altitude != null ? `${Number(altitude).toFixed(0)} km` : null}
          color="var(--space-cyan)"
        />
        <StatCell
          label="Velocity"
          value={velocity != null ? `${Number(velocity).toFixed(2)} km/s` : null}
          color="var(--space-amber)"
        />
        <StatCell
          label="Orbital Period"
          value={period != null ? `${Number(period).toFixed(1)} min` : null}
          color="var(--space-green)"
        />
        <StatCell
          label="Object Type"
          value={satellite.object_type ?? satellite.type ?? 'Unknown'}
          color={tc.color}
        />
      </div>

      {/* ── TLE section ───────────────────────────────────────────────────── */}
      <TLESection
        tle1={satellite.tle_line1 ?? satellite.line1}
        tle2={satellite.tle_line2 ?? satellite.line2}
      />
    </div>
  )
}

SatelliteInfo.propTypes = {
  /** NORAD catalog ID of the satellite to display. Null shows empty state. */
  noradId: PropTypes.string,
}

SatelliteInfo.defaultProps = {
  noradId: null,
}

export default SatelliteInfo
