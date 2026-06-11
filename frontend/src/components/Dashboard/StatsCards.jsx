/**
 * @fileoverview StatsCards — 4-card summary strip with live "Last Scan" timer.
 */

import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Globe, Trash2, AlertTriangle, Clock } from 'lucide-react'

// ── Relative time utility ─────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string from a timestamp.
 * @param {string | Date | number | null} timestamp
 * @returns {string}
 */
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

// ── StatCard Sub-component ────────────────────────────────────────────────────

/**
 * Individual stat card with hover glow.
 *
 * @param {{ icon: JSX.Element, value: string | number, label: string, color?: string, accentColor?: string }} props
 */
function StatCard({ icon, value, label, color = 'var(--space-text)', accentColor = 'var(--space-cyan)' }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        flex: 1,
        minWidth: 140,
        background: '#0f0f1a',
        border: `1px solid ${hovered ? accentColor + '55' : '#1a1a2e'}`,
        borderRadius: '0.75rem',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
        boxShadow: hovered ? `0 0 20px ${accentColor}18` : 'none',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon container */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '0.5rem',
          background: `${accentColor}18`,
          border: `1px solid ${accentColor}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accentColor,
          flexShrink: 0,
          transition: 'background var(--transition-base)',
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '1.375rem',
            fontWeight: 700,
            color,
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value ?? '—'}
        </div>
        <div
          style={{
            fontSize: '0.7rem',
            color: 'var(--space-text-muted)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            marginTop: '0.2rem',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

StatCard.propTypes = {
  icon:        PropTypes.node.isRequired,
  value:       PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  label:       PropTypes.string.isRequired,
  color:       PropTypes.string,
  accentColor: PropTypes.string,
}

// ── StatsCards Component ──────────────────────────────────────────────────────

/**
 * Row of 4 summary statistics cards.
 *
 * @param {{ stats: { total: number, debris: number, alerts: number, last_scan: string | Date | null } }} props
 * @returns {JSX.Element}
 */
function StatsCards({ stats }) {
  // Auto-updating "last scan" relative time
  const [lastScanLabel, setLastScanLabel] = useState('—')

  useEffect(() => {
    const update = () => setLastScanLabel(relativeTimeAgo(stats?.last_scan ?? null))
    update()
    const interval = setInterval(update, 10_000) // refresh every 10 s
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
        gap: '0.75rem',
        flexWrap: 'wrap',
        padding: '0.75rem 1rem',
        background: 'var(--space-bg)',
      }}
    >
      <StatCard
        icon={<Globe size={18} />}
        value={total.toLocaleString()}
        label="Total Objects"
        color="var(--space-text)"
        accentColor="var(--space-cyan)"
      />
      <StatCard
        icon={<Trash2 size={18} />}
        value={debris.toLocaleString()}
        label="Debris Count"
        color="#ff4466"
        accentColor="#ff4466"
      />
      <StatCard
        icon={<AlertTriangle size={18} />}
        value={alerts.toLocaleString()}
        label="Active Alerts"
        color={hasAlerts ? '#ff9d00' : 'var(--space-text-muted)'}
        accentColor={hasAlerts ? '#ff9d00' : 'var(--space-border-bright)'}
      />
      <StatCard
        icon={<Clock size={18} />}
        value={lastScanLabel}
        label="Last Scan"
        color="var(--space-text-muted)"
        accentColor="var(--space-green)"
      />
    </div>
  )
}

StatsCards.propTypes = {
  /** Dashboard-level statistics object */
  stats: PropTypes.shape({
    total:             PropTypes.number,
    total_satellites:  PropTypes.number,
    debris:            PropTypes.number,
    debris_count:      PropTypes.number,
    total_debris:      PropTypes.number,
    alerts:            PropTypes.number,
    active_conjunctions: PropTypes.number,
    last_scan:         PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  }),
}

StatsCards.defaultProps = {
  stats: null,
}

export default StatsCards
