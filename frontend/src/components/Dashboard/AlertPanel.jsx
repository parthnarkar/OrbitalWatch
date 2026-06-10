/**
 * @fileoverview AlertPanel — sortable, filterable conjunction alert table.
 */

import { useState, useMemo, memo, useCallback } from 'react'
import PropTypes from 'prop-types'

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Format a Date (or ISO string) as a relative "Xh Ym" string.
 * @param {string | Date | null} dt
 * @returns {string}
 */
function relativeTime(dt) {
  if (!dt) return '—'
  const now  = Date.now()
  const then = new Date(dt).getTime()
  const diff = then - now  // ms

  if (isNaN(diff)) return '—'

  const abs  = Math.abs(diff)
  const past = diff < 0
  const h    = Math.floor(abs / 3_600_000)
  const m    = Math.floor((abs % 3_600_000) / 60_000)
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`
  return past ? `${label} ago` : `in ${label}`
}

/** Risk priority for sorting (HIGH > MEDIUM > LOW) */
const RISK_PRIORITY = { HIGH: 3, MEDIUM: 2, LOW: 1 }

/** Badge config per risk level */
const RISK_CONFIG = {
  HIGH:   { bg: 'rgba(255,77,77,0.2)',  color: '#ff4d4d', border: 'rgba(255,77,77,0.4)' },
  MEDIUM: { bg: 'rgba(255,157,0,0.2)', color: '#ff9d00', border: 'rgba(255,157,0,0.4)' },
  LOW:    { bg: 'rgba(0,255,157,0.15)', color: '#00ff9d', border: 'rgba(0,255,157,0.3)' },
}

// ── Risk Badge ────────────────────────────────────────────────────────────────

/** @param {{ level: string }} props */
function RiskBadge({ level }) {
  const cfg = RISK_CONFIG[level] ?? RISK_CONFIG.LOW
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {level ?? 'LOW'}
    </span>
  )
}
RiskBadge.propTypes = { level: PropTypes.string }

// ── Table Row (memoised) ──────────────────────────────────────────────────────

/**
 * Individual conjunction row, memoised to prevent re-renders from parent.
 *
 * @param {{ conjunction: Object, isSelected: boolean, onSelect: Function }} props
 */
const ConjunctionRow = memo(function ConjunctionRow({ conjunction, isSelected, onSelect }) {
  const c = conjunction
  const approachTime = c.approach_time ?? c.tca ?? c.time_of_closest_approach
  const missDist     = c.miss_distance ?? c.distance
  const prob         = c.collision_probability ?? c.probability ?? c.prob
  const sat1         = c.satellite1_name ?? c.sat1_name ?? c.primary ?? '—'
  const sat2         = c.satellite2_name ?? c.sat2_name ?? c.secondary ?? '—'

  return (
    <tr
      id={`conjunction-row-${c.id ?? c.conjunction_id}`}
      onClick={() => onSelect(c)}
      title="Click to view detail"
      style={{
        cursor: 'pointer',
        background: isSelected ? 'rgba(0,212,255,0.06)' : 'transparent',
        outline: isSelected ? '1px solid rgba(0,212,255,0.4)' : 'none',
        outlineOffset: '-1px',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
    >
      <td style={tdStyle}><RiskBadge level={c.risk_level} /></td>
      <td style={tdStyle}>
        <div style={{ fontSize: '0.8rem', color: 'var(--space-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{sat1}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--space-text-muted)', marginTop: 2, whiteSpace: 'nowrap' }}>+ {sat2}</div>
      </td>
      <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace" }}>
        <span title={approachTime ? new Date(approachTime).toLocaleString() : undefined}>
          {relativeTime(approachTime)}
        </span>
      </td>
      <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", color: 'var(--space-cyan)' }}>
        {missDist != null ? `${Number(missDist).toFixed(2)} km` : '—'}
      </td>
      <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", color: 'var(--space-amber)' }}>
        {prob != null ? `${(Number(prob) * 100).toFixed(2)}%` : '—'}
      </td>
    </tr>
  )
})

ConjunctionRow.propTypes = {
  conjunction: PropTypes.object.isRequired,
  isSelected:  PropTypes.bool,
  onSelect:    PropTypes.func.isRequired,
}

const tdStyle = {
  padding: '0.625rem 0.875rem',
  verticalAlign: 'middle',
  borderBottom: '1px solid rgba(26,26,46,0.8)',
  fontSize: '0.8rem',
  color: 'var(--space-text-muted)',
}

// ── AlertPanel Component ───────────────────────────────────────────────────────

/**
 * Sortable, filterable table of conjunction alerts.
 *
 * @param {{ conjunctions: Object[], onSelect: (conjunction: Object) => void }} props
 * @returns {JSX.Element}
 */
function AlertPanel({ conjunctions, onSelect }) {
  const [sortField,     setSortField]     = useState('risk_level')
  const [sortDirection, setSortDirection] = useState(/** @type {'asc'|'desc'} */ ('desc'))
  const [filterRisk,    setFilterRisk]    = useState(/** @type {'ALL'|'LOW'|'MEDIUM'|'HIGH'} */ ('ALL'))
  const [selectedId,    setSelectedId]    = useState(/** @type {string|null} */ (null))

  const handleSort = useCallback((field) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDirection('desc')
      return field
    })
  }, [])

  const handleSelect = useCallback((c) => {
    const id = c.id ?? c.conjunction_id ?? null
    setSelectedId((prev) => (prev === id ? null : id))
    onSelect?.(c)
  }, [onSelect])

  // ── Filtered + sorted data ─────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let data = [...(conjunctions ?? [])]

    if (filterRisk !== 'ALL') {
      data = data.filter((c) => c.risk_level === filterRisk)
    }

    data.sort((a, b) => {
      let av, bv
      if (sortField === 'risk_level') {
        av = RISK_PRIORITY[a.risk_level] ?? 0
        bv = RISK_PRIORITY[b.risk_level] ?? 0
      } else if (sortField === 'approach_time') {
        av = new Date(a.approach_time ?? a.tca ?? 0).getTime()
        bv = new Date(b.approach_time ?? b.tca ?? 0).getTime()
      } else if (sortField === 'miss_distance') {
        av = Number(a.miss_distance ?? a.distance ?? 0)
        bv = Number(b.miss_distance ?? b.distance ?? 0)
      } else if (sortField === 'probability') {
        av = Number(a.collision_probability ?? a.probability ?? 0)
        bv = Number(b.collision_probability ?? b.probability ?? 0)
      } else {
        av = 0; bv = 0
      }

      return sortDirection === 'asc' ? av - bv : bv - av
    })

    return data
  }, [conjunctions, filterRisk, sortField, sortDirection])

  // ── Sort indicator ─────────────────────────────────────────────────────────
  const sortIndicator = (field) => {
    if (sortField !== field) return <span style={{ color: 'var(--space-text-dim)', marginLeft: 4 }}>⇅</span>
    return <span style={{ color: 'var(--space-cyan)', marginLeft: 4 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  const thStyle = {
    padding: '0.625rem 0.875rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--space-text-muted)',
    background: 'rgba(0,0,0,0.3)',
    borderBottom: '1px solid var(--space-border)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    textAlign: 'left',
  }

  const filterTabs = ['ALL', 'HIGH', 'MEDIUM', 'LOW']

  return (
    <div
      id="alert-panel"
      style={{
        background: '#0f0f1a',
        border: '1px solid var(--space-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header + filter tabs ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: '1rem 1.25rem 0',
          borderBottom: '1px solid var(--space-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--space-text)', flex: 1 }}>
          Conjunction Alerts
          {displayed.length > 0 && (
            <span
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.1rem 0.5rem',
                borderRadius: 999,
                background: 'rgba(255,77,77,0.15)',
                color: '#ff4d4d',
                border: '1px solid rgba(255,77,77,0.3)',
              }}
            >
              {displayed.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {filterTabs.map((tab) => {
            const active = filterRisk === tab
            const riskCfg = tab !== 'ALL' ? RISK_CONFIG[tab] : null
            return (
              <button
                key={tab}
                id={`filter-tab-${tab.toLowerCase()}`}
                onClick={() => setFilterRisk(tab)}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-md)',
                  border: active
                    ? `1px solid ${riskCfg?.border ?? 'rgba(0,212,255,0.4)'}`
                    : '1px solid transparent',
                  background: active
                    ? (riskCfg?.bg ?? 'rgba(0,212,255,0.1)')
                    : 'transparent',
                  color: active
                    ? (riskCfg?.color ?? 'var(--space-cyan)')
                    : 'var(--space-text-muted)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  marginBottom: '0.75rem',
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        {displayed.length === 0 ? (
          <div
            style={{
              padding: '3rem 1.25rem',
              textAlign: 'center',
              color: 'var(--space-text-muted)',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.4 }}>🛡️</div>
            No conjunctions detected in the next 72 hours
          </div>
        ) : (
          <table
            role="grid"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 640,
            }}
          >
            <thead>
              <tr>
                {[
                  { key: 'risk_level',    label: 'Risk' },
                  { key: null,            label: 'Satellites', noSort: true },
                  { key: 'approach_time', label: 'Approach Time' },
                  { key: 'miss_distance', label: 'Miss Distance' },
                  { key: 'probability',   label: 'Probability' },
                ].map(({ key, label, noSort }) => (
                  <th
                    key={label}
                    style={thStyle}
                    onClick={noSort ? undefined : () => handleSort(key)}
                    aria-sort={
                      key && sortField === key
                        ? sortDirection === 'asc' ? 'ascending' : 'descending'
                        : undefined
                    }
                  >
                    {label}
                    {!noSort && key && sortIndicator(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((c, idx) => {
                const id = c.id ?? c.conjunction_id ?? idx
                return (
                  <ConjunctionRow
                    key={id}
                    conjunction={c}
                    isSelected={selectedId === id}
                    onSelect={handleSelect}
                  />
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

AlertPanel.propTypes = {
  /** Array of conjunction event objects */
  conjunctions: PropTypes.arrayOf(PropTypes.object),
  /** Callback when a row is clicked */
  onSelect: PropTypes.func,
}

AlertPanel.defaultProps = {
  conjunctions: [],
  onSelect: null,
}

export default AlertPanel
