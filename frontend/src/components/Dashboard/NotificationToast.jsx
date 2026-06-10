/**
 * @fileoverview NotificationToast.jsx — Slide-in real-time alert notification.
 */

import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

/** Risk level color mapping */
const RISK_COLORS = {
  HIGH: '#ff4d4d',
  MEDIUM: '#ff9d00',
  LOW: '#00ff9d',
}

/** Risk level background mapping */
const RISK_BGS = {
  HIGH: 'rgba(255, 77, 77, 0.15)',
  MEDIUM: 'rgba(255, 157, 0, 0.15)',
  LOW: 'rgba(0, 255, 157, 0.15)',
}

/**
 * Format a Date as a relative countdown string (e.g. "2h 15m" or "45m").
 *
 * @param {string | Date} dt
 * @returns {string}
 */
function relativeTime(dt) {
  if (!dt) return '—'
  const now = Date.now()
  const then = new Date(dt).getTime()
  const diff = then - now

  if (isNaN(diff)) return '—'

  const abs = Math.abs(diff)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`
  return diff < 0 ? `${label} ago` : `in ${label}`
}

/**
 * NotificationToast component.
 *
 * @param {Object} props
 * @param {Object} props.alert
 * @param {Function} props.onDismiss
 * @param {Function} props.onClick
 * @returns {JSX.Element}
 */
export function NotificationToast({ alert, onDismiss, onClick }) {
  const [isExiting, setIsExiting] = useState(false)

  const sat1 = alert.sat1_name ?? alert.satellite1_name ?? 'Sat A'
  const sat2 = alert.sat2_name ?? alert.satellite2_name ?? 'Sat B'
  const approachTime = alert.approach_time ?? alert.tca ?? alert.time_of_closest_approach
  const riskLevel = alert.risk_level ?? 'LOW'
  const riskColor = RISK_COLORS[riskLevel] ?? RISK_COLORS.LOW
  const riskBg = RISK_BGS[riskLevel] ?? RISK_BGS.LOW

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const autoDismissTimer = setTimeout(() => {
      setIsExiting(true)
    }, 8000)

    return () => clearTimeout(autoDismissTimer)
  }, [])

  // Call onDismiss after the exit animation completes (300ms)
  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        onDismiss()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isExiting, onDismiss])

  const handleClose = (e) => {
    e.stopPropagation()
    setIsExiting(true)
  }

  return (
    <div
      onClick={onClick}
      className={isExiting ? 'toast-exit' : 'toast-enter'}
      style={{
        background: '#0f0f1a',
        borderLeft: `4px solid ${riskColor}`,
        borderTop: '1px solid var(--space-border, #1a1a2e)',
        borderRight: '1px solid var(--space-border, #1a1a2e)',
        borderBottom: '1px solid var(--space-border, #1a1a2e)',
        borderRadius: '8px',
        padding: '16px',
        maxWidth: '400px',
        width: '320px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Risk Badge */}
        <span
          style={{
            background: riskBg,
            color: riskColor,
            border: `1px solid ${riskColor}50`,
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {riskLevel} Risk
        </span>

        {/* Close Button */}
        <button
          className="toast-close-btn"
          onClick={handleClose}
          aria-label="Dismiss notification"
          style={{
            color: 'var(--space-text-dim, #555577)',
            fontSize: '1.25rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            borderRadius: '4px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--space-text-dim, #555577)' }}
        >
          &times;
        </button>
      </div>

      <div style={{ fontSize: '0.8rem', color: 'var(--space-text, #e8e8f0)', fontWeight: 500, lineHeight: 1.4 }}>
        Close approach: <span style={{ fontWeight: 700 }}>{sat1}</span> &amp; <span style={{ fontWeight: 700 }}>{sat2}</span> {relativeTime(approachTime)}
      </div>
    </div>
  )
}

NotificationToast.propTypes = {
  /** Alert conjunction object */
  alert: PropTypes.object.isRequired,
  /** Callback to remove toast from queue */
  onDismiss: PropTypes.func.isRequired,
  /** Callback to navigate to details when toast is clicked */
  onClick: PropTypes.func.isRequired,
}

export default NotificationToast
