/**
 * @fileoverview StatsCards — Minimal bottom stats bar with live "Last Scan" timer.
 */

import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

// ── Relative time utility ─────────────────────────────────────────────────────

function relativeTimeAgo(timestamp) {
  if (!timestamp) return '—'
  const diff = Date.now() - new Date(timestamp).getTime()
  if (isNaN(diff) || diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 60)   return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Icon Components ───────────────────────────────────────────────────────────

const TrackedIcon = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

const DebrisIcon = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

const AlertIcon = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const ClockIcon = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

TrackedIcon.propTypes = { color: PropTypes.string.isRequired }
DebrisIcon.propTypes  = { color: PropTypes.string.isRequired }
AlertIcon.propTypes   = { color: PropTypes.string.isRequired }
ClockIcon.propTypes   = { color: PropTypes.string.isRequired }

// ── StatColumn Sub-component ──────────────────────────────────────────────────

function StatColumn({ icon, value, label, color, isLast }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
        padding: '0 1.25rem',
        borderRight: isLast ? 'none' : '1px solid #1a1a2e',
        background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background 150ms ease',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon */}
      <div style={{ flexShrink: 0, opacity: 0.85, display: 'flex', alignItems: 'center' }}>
        {icon}
      </div>

      {/* Text Block (Inline for Minimalism) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <span
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {value ?? '—'}
        </span>
        <span
          style={{
            fontSize: '0.625rem',
            color: '#5a5a80',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

StatColumn.propTypes = {
  icon:   PropTypes.node.isRequired,
  value:  PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  label:  PropTypes.string.isRequired,
  color:  PropTypes.string.isRequired,
  isLast: PropTypes.bool,
}

StatColumn.defaultProps = { isLast: false }

// ── StatsCards Component ──────────────────────────────────────────────────────

function StatsCards({ stats }) {
  const [lastScanLabel, setLastScanLabel] = useState('—')

  useEffect(() => {
    const update = () => setLastScanLabel(relativeTimeAgo(stats?.last_scan ?? null))
    update()
    const interval = setInterval(update, 10_000)
    return () => clearInterval(interval)
  }, [stats?.last_scan])

  const total  = stats?.total  ?? stats?.total_satellites ?? 0
  const debris = stats?.debris ?? stats?.debris_count ?? stats?.total_debris ?? 0
  const alerts = stats?.alerts ?? stats?.active_conjunctions ?? 0
  const hasAlerts = alerts > 0

  return (
    <div
      id="stats-cards"
      style={{
        display: 'flex',
        height: 48,
        background: 'rgba(5, 5, 12, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid #1a1a2e',
        flexShrink: 0,
      }}
    >
      <StatColumn
        icon={<TrackedIcon color="#00ff9d" />}
        value={total.toLocaleString()}
        label="Tracked"
        color="#00ff9d"
      />
      <StatColumn
        icon={<DebrisIcon color="#ff4d4d" />}
        value={debris.toLocaleString()}
        label="Debris"
        color="#ff4d4d"
      />
      <StatColumn
        icon={<AlertIcon color={hasAlerts ? '#ff9d00' : '#5a5a80'} />}
        value={alerts.toLocaleString()}
        label="Alerts"
        color={hasAlerts ? '#ff9d00' : '#5a5a80'}
      />
      <StatColumn
        icon={<ClockIcon color="#00d4ff" />}
        value={lastScanLabel}
        label="Last Scan"
        color="#00d4ff"
        isLast
      />
    </div>
  )
}

StatsCards.propTypes = {
  stats: PropTypes.shape({
    total:               PropTypes.number,
    total_satellites:    PropTypes.number,
    debris:              PropTypes.number,
    debris_count:        PropTypes.number,
    total_debris:        PropTypes.number,
    alerts:              PropTypes.number,
    active_conjunctions: PropTypes.number,
    last_scan:           PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  }),
}

StatsCards.defaultProps = { stats: null }

export default StatsCards
