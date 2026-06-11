/**
 * @fileoverview FilterBar.jsx — Horizontal filter bar for satellite type and altitude filters.
 */

import PropTypes from 'prop-types'

const ALL_TYPES = ['payload', 'debris', 'rocket body', 'unknown']

const DEFAULT_FILTERS = {
  types: ['payload', 'debris', 'rocket body', 'unknown'],
  minAltitude: 0,
  maxAltitude: 40000,
}

/**
 * FilterBar component.
 *
 * @param {Object} props
 * @param {Object} props.filters
 * @param {Function} props.onChange
 * @returns {JSX.Element}
 */
export function FilterBar({ filters, onChange }) {
  const activeTypes = filters.types ?? DEFAULT_FILTERS.types
  const minAltitude = filters.minAltitude ?? DEFAULT_FILTERS.minAltitude
  const maxAltitude = filters.maxAltitude ?? DEFAULT_FILTERS.maxAltitude

  const handleTypeToggle = (type) => {
    let nextTypes
    if (activeTypes.includes(type)) {
      nextTypes = activeTypes.filter((t) => t !== type)
    } else {
      nextTypes = [...activeTypes, type]
    }
    onChange({
      ...filters,
      types: nextTypes,
    })
  }

  const handleAltitudeChange = (field, value) => {
    const numVal = value === '' ? '' : Math.max(0, Number(value))
    onChange({
      ...filters,
      [field]: numVal,
    })
  }

  const handleReset = () => {
    onChange(DEFAULT_FILTERS)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: '#0a0a12',
        border: '1px solid var(--space-border, #1a1a2e)',
        borderRadius: '8px',
        width: '100%',
      }}
    >
      {/* Object Type Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--space-text-muted, #8888aa)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Object Types:
        </span>
        {ALL_TYPES.map((type) => {
          const isActive = activeTypes.includes(type)
          return (
            <button
              key={type}
              onClick={() => handleTypeToggle(type)}
              style={{
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
                textTransform: 'capitalize',
                cursor: 'pointer',
                transition: 'all var(--transition-fast, 150ms ease)',
                background: isActive ? 'var(--space-cyan-dim, rgba(0, 212, 255, 0.15))' : 'var(--space-card, #0f0f1a)',
                border: isActive ? '1px solid var(--space-cyan, #00d4ff)' : '1px solid var(--space-border, #1a1a2e)',
                color: isActive ? 'var(--space-cyan, #00d4ff)' : 'var(--space-text-muted, #8888aa)',
                boxShadow: isActive ? '0 0 8px rgba(0, 212, 255, 0.2)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--space-border-bright, #2a2a4a)'
                  e.currentTarget.style.color = 'var(--space-text, #e8e8f0)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--space-border, #1a1a2e)'
                  e.currentTarget.style.color = 'var(--space-text-muted, #8888aa)'
                }
              }}
            >
              {type}
            </button>
          )
        })}
      </div>

      <div className="hide-mobile" style={{ width: '1px', height: '24px', background: 'var(--space-border, #1a1a2e)', alignSelf: 'center' }} />

      {/* Altitude Range Inputs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--space-text-muted, #8888aa)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Altitude (km):
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="number"
            min={0}
            max={40000}
            step={100}
            value={minAltitude}
            onChange={(e) => handleAltitudeChange('minAltitude', e.target.value)}
            placeholder="Min"
            aria-label="Minimum altitude in kilometers"
            style={{
              width: '80px',
              height: '28px',
              padding: '2px 8px',
              fontSize: '0.75rem',
              background: 'var(--space-card, #0f0f1a)',
              border: '1px solid var(--space-border, #1a1a2e)',
              borderRadius: '6px',
              color: 'var(--space-text, #e8e8f0)',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--space-text-dim, #555577)' }}>to</span>
          <input
            type="number"
            min={0}
            max={40000}
            step={100}
            value={maxAltitude}
            onChange={(e) => handleAltitudeChange('maxAltitude', e.target.value)}
            placeholder="Max"
            aria-label="Maximum altitude in kilometers"
            style={{
              width: '80px',
              height: '28px',
              padding: '2px 8px',
              fontSize: '0.75rem',
              background: 'var(--space-card, #0f0f1a)',
              border: '1px solid var(--space-border, #1a1a2e)',
              borderRadius: '6px',
              color: 'var(--space-text, #e8e8f0)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        style={{
          padding: '4px 12px',
          fontSize: '0.75rem',
          fontWeight: 600,
          borderRadius: '6px',
          border: '1px solid var(--space-border, #1a1a2e)',
          background: 'transparent',
          color: 'var(--space-text-dim, #555577)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast, 150ms ease)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 68, 102, 0.4)'
          e.currentTarget.style.color = 'var(--space-red, #ff4466)'
          e.currentTarget.style.background = 'rgba(255, 68, 102, 0.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--space-border, #1a1a2e)'
          e.currentTarget.style.color = 'var(--space-text-dim, #555577)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        Reset Filters
      </button>
    </div>
  )
}

FilterBar.propTypes = {
  /** The current filters object state */
  filters: PropTypes.shape({
    types: PropTypes.arrayOf(PropTypes.string),
    minAltitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    maxAltitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
  /** Callback triggered when filters change */
  onChange: PropTypes.func.isRequired,
}

export default FilterBar
