/**
 * @fileoverview AlertDetail — slide-out detail panel for a single conjunction.
 * Renders as a fixed right-side drawer with backdrop blur.
 */

import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { X } from 'lucide-react'

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Risk config */
const RISK_CONFIG = {
  HIGH:   { bg: 'rgba(255,77,77,0.2)',  color: '#ff4d4d', border: '#ff4d4d' },
  MEDIUM: { bg: 'rgba(255,157,0,0.2)', color: '#ff9d00', border: '#ff9d00' },
  LOW:    { bg: 'rgba(0,255,157,0.15)', color: '#00ff9d', border: '#00ff9d' },
}

/**
 * Countdown string for a future datetime.
 * @param {string | Date | null} dt
 * @returns {string}
 */
function countdown(dt) {
  if (!dt) return '—'
  const diff = new Date(dt).getTime() - Date.now()
  if (isNaN(diff) || diff < 0) return new Date(dt).toLocaleString()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  if (h > 24) return new Date(dt).toLocaleString()
  return `T-${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Satellite Mini Card ────────────────────────────────────────────────────────

/** @param {{ name: string, noradId: string, type: string }} props */
function SatMiniCard({ name, noradId, type }) {
  const t = (type || '').toLowerCase()
  const color =
    t === 'payload' ? '#00ff9d' :
    t === 'debris'  ? '#ff4466' :
    t === 'rocket body' ? '#ffbb33' : '#8888aa'

  return (
    <div
      style={{
        flex: 1,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--space-border)',
        borderRadius: 8,
        padding: '0.75rem',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: '0.8rem',
          fontWeight: 700,
          color: 'var(--space-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '0.25rem',
        }}
      >
        {name || '—'}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--space-cyan)',
          marginBottom: '0.35rem',
        }}
      >
        #{noradId || '—'}
      </div>
      <span
        style={{
          fontSize: '0.6rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '0.15rem 0.45rem',
          borderRadius: 999,
          background: `${color}22`,
          color,
          border: `1px solid ${color}55`,
        }}
      >
        {type || 'Unknown'}
      </span>
    </div>
  )
}
SatMiniCard.propTypes = {
  name:    PropTypes.string,
  noradId: PropTypes.string,
  type:    PropTypes.string,
}

// ── Detail Row ────────────────────────────────────────────────────────────────

/** @param {{ label: string, value: string }} props */
function DetailRow({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.6rem 0',
        borderBottom: '1px solid rgba(26,26,46,0.8)',
        gap: '0.5rem',
      }}
    >
      <span style={{ fontSize: '0.75rem', color: 'var(--space-text-muted)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--space-text)',
          textAlign: 'right',
          wordBreak: 'break-all',
        }}
      >
        {value ?? '—'}
      </span>
    </div>
  )
}
DetailRow.propTypes = { label: PropTypes.string, value: PropTypes.string }

// ── AlertDetail Component ─────────────────────────────────────────────────────

/**
 * Slide-out detail panel for a single conjunction alert.
 * Closes on Escape key press or backdrop click.
 *
 * @param {{ conjunction: Object | null, onClose: Function }} props
 * @returns {JSX.Element | null}
 */
function AlertDetail({ conjunction, onClose }) {
  const [show3DPreview, setShow3DPreview] = useState(false)
  const [timeStr, setTimeStr] = useState('')

  // Live countdown tick
  useEffect(() => {
    if (!conjunction) return
    const approachTime = conjunction.approach_time ?? conjunction.tca
    const update = () => setTimeStr(countdown(approachTime))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [conjunction])

  // Close on Escape
  useEffect(() => {
    if (!conjunction) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [conjunction, onClose])

  const handle3DPreview = useCallback(() => {
    setShow3DPreview((v) => !v)
    // Emit custom event so ThreeGlobe can pick up both satellites
    const norad1 = conjunction?.satellite1_norad ?? conjunction?.norad1
    const norad2 = conjunction?.satellite2_norad ?? conjunction?.norad2
    if (norad1 || norad2) {
      window.dispatchEvent(new CustomEvent('ow:focus-conjunction', { detail: { norad1, norad2 } }))
    }
  }, [conjunction])

  if (!conjunction) return null

  const riskLevel = conjunction.risk_level ?? 'LOW'
  const riskCfg   = RISK_CONFIG[riskLevel] ?? RISK_CONFIG.LOW
  const prob       = conjunction.collision_probability ?? conjunction.probability ?? conjunction.prob
  const missDist   = conjunction.miss_distance ?? conjunction.distance
  const relVel     = conjunction.relative_velocity ?? conjunction.rel_velocity

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────────── */}
      <div
        id="alert-detail-backdrop"
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease forwards',
        }}
      />

      {/* ── Panel ─────────────────────────────────────────────────────────────── */}
      <div
        id="alert-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Conjunction alert detail"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 400,
          maxWidth: '100vw',
          background: '#0a0a12',
          borderLeft: `3px solid ${riskCfg.border}`,
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--space-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            position: 'sticky',
            top: 0,
            background: '#0a0a12',
            zIndex: 2,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--space-text-muted)', marginBottom: '0.3rem' }}>
              Conjunction Alert
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.25rem 0.75rem',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: riskCfg.bg,
                color: riskCfg.color,
                border: `1px solid ${riskCfg.border}55`,
              }}
            >
              {riskLevel} RISK
            </span>
          </div>

          <button
            id="alert-detail-close"
            aria-label="Close detail panel"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--space-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--space-text-muted)',
              transition: 'all var(--transition-fast)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,68,102,0.15)'
              e.currentTarget.style.borderColor = 'rgba(255,68,102,0.4)'
              e.currentTarget.style.color = '#ff4466'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.borderColor = 'var(--space-border)'
              e.currentTarget.style.color = 'var(--space-text-muted)'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Two satellite cards */}
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--space-text-dim)', marginBottom: '0.6rem' }}>
              Involved Objects
            </div>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <SatMiniCard
                name={conjunction.satellite1_name ?? conjunction.sat1_name ?? conjunction.primary}
                noradId={String(conjunction.satellite1_norad ?? conjunction.norad1 ?? '')}
                type={conjunction.satellite1_type ?? conjunction.sat1_type}
              />
              <SatMiniCard
                name={conjunction.satellite2_name ?? conjunction.sat2_name ?? conjunction.secondary}
                noradId={String(conjunction.satellite2_norad ?? conjunction.norad2 ?? '')}
                type={conjunction.satellite2_type ?? conjunction.sat2_type}
              />
            </div>
          </div>

          {/* Details grid */}
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--space-text-dim)', marginBottom: '0.5rem' }}>
              Event Details
            </div>
            <DetailRow label="Closest Approach" value={timeStr} />
            <DetailRow
              label="Miss Distance"
              value={missDist != null ? `${Number(missDist).toFixed(3)} km` : null}
            />
            <DetailRow
              label="Relative Velocity"
              value={relVel != null ? `${Number(relVel).toFixed(2)} km/s` : 'TBD'}
            />
            <DetailRow
              label="Collision Probability"
              value={prob != null ? `${(Number(prob) * 100).toFixed(3)}%` : null}
            />
          </div>

          {/* 3D Preview button */}
          <button
            id="btn-3d-preview"
            onClick={handle3DPreview}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: show3DPreview ? 'rgba(0,212,255,0.15)' : 'rgba(0,212,255,0.08)',
              border: `1px solid ${show3DPreview ? 'rgba(0,212,255,0.5)' : 'rgba(0,212,255,0.2)'}`,
              color: 'var(--space-cyan)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              marginTop: 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,212,255,0.2)'
              e.currentTarget.style.borderColor = 'rgba(0,212,255,0.6)'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(0,212,255,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = show3DPreview ? 'rgba(0,212,255,0.15)' : 'rgba(0,212,255,0.08)'
              e.currentTarget.style.borderColor = show3DPreview ? 'rgba(0,212,255,0.5)' : 'rgba(0,212,255,0.2)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <span style={{ fontSize: '1rem' }}>🌐</span>
            {show3DPreview ? 'Focusing on Globe…' : 'Focus on Globe (3D Preview)'}
          </button>
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

AlertDetail.propTypes = {
  /** The conjunction event object to display. Null hides the panel. */
  conjunction: PropTypes.object,
  /** Called when the panel should be closed */
  onClose: PropTypes.func,
}

AlertDetail.defaultProps = {
  conjunction: null,
  onClose: null,
}

export default AlertDetail
