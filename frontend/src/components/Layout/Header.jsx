/**
 * @fileoverview Header component — sticky top bar with logo, clock, LIVE badge, nav.
 * Redesigned: OrbitalWatch logo on left, UTC clock center-right, LIVE badge + settings on far right.
 */

import { useState } from 'react'
import PropTypes from 'prop-types'
import { Clapperboard, Settings } from 'lucide-react'
import { useAppContext } from '../../context/AppContext.jsx'
import SearchBar from '../Dashboard/SearchBar.jsx'
import OrbitalClock from '../Dashboard/OrbitalClock.jsx'
import ShortcutsButton from './KeyboardShortcuts.jsx'

// ── Nav Icon SVGs ─────────────────────────────────────────────────────────────

const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

// ── Header Component ──────────────────────────────────────────────────────────

/**
 * @param {{
 *   connected: boolean,
 *   demoEnabled?: boolean,
 *   onToggleDemo?: Function,
 *   activeNav?: string,
 *   onNavChange?: Function,
 *   alertCount?: number,
 * }} props
 */
function Header({ connected, demoEnabled, onToggleDemo, activeNav, onNavChange, alertCount }) {
  const [hoveredNav, setHoveredNav] = useState(null)
  const { setSelectedSatellite } = useAppContext()

  const handleSearchSelect = (sat) => {
    setSelectedSatellite(sat)
  }

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Globe',  icon: IconDashboard },
    { id: 'alerts',    label: 'Alerts', icon: IconAlert },
  ]

  return (
    <header
      id="main-header"
      style={{
        height: 'var(--header-height)',
        background: 'rgba(5, 5, 12, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid #1a1a2e',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1.5rem',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* ── Left: Logo ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
        {/* Orbital icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid #00d4ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 0 12px rgba(0,212,255,0.4)',
            flexShrink: 0,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4ff' }} />
          <div
            style={{
              position: 'absolute',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#00ff9d',
              animation: 'orbit 3s linear infinite',
              boxShadow: '0 0 8px rgba(0,255,157,0.6)',
            }}
          />
        </div>
        <span
          style={{
            fontSize: '1.0625rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #00d4ff, #00ff9d)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          OrbitalWatch
        </span>
      </div>

      {/* ── Center Nav ─────────────────────────────────────────────────────────── */}
      <nav aria-label="Primary navigation" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '1.5rem' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeNav === id
          const isHovered = hoveredNav === id
          const showBadge = id === 'alerts' && alertCount > 0
          return (
            <button
              key={id}
              id={`nav-${id}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavChange?.(id)}
              onMouseEnter={() => setHoveredNav(id)}
              onMouseLeave={() => setHoveredNav(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.375rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#00d4ff' : isHovered ? '#e8e8f0' : '#8888aa',
                background: isActive ? 'rgba(0,212,255,0.12)' : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: isActive ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
                transition: 'all 150ms ease',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <Icon />
              {label}
              {showBadge && (
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.35rem',
                    borderRadius: 999,
                    background: 'rgba(255,77,77,0.2)',
                    color: '#ff4d4d',
                    border: '1px solid rgba(255,77,77,0.4)',
                    animation: 'pulse-dot 2s ease-in-out infinite',
                    minWidth: 18,
                    textAlign: 'center',
                  }}
                >
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>
          )
        })}
        {activeNav === 'dashboard' && (
          <div style={{ marginLeft: '1rem', width: '280px' }}>
            <SearchBar onSelect={handleSearchSelect} />
          </div>
        )}
      </nav>

      {/* ── Spacer ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Right Side Actions ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        {/* UTC Clock */}
        <span
          className="hide-xs"
          style={{
            display: 'flex',
            alignItems: 'center',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '0.8rem',
            color: '#8a8ab0',
            letterSpacing: '0.02em',
          }}
        >
          <OrbitalClock />
        </span>

        {/* Demo Mode toggle */}
        {onToggleDemo && (
          <button
            id="btn-demo-mode"
            aria-label={demoEnabled ? 'Disable demo mode' : 'Enable demo mode'}
            title={demoEnabled ? 'Demo Mode ON — click to disable' : 'Enable Demo Mode'}
            onClick={onToggleDemo}
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: demoEnabled ? 'rgba(0,212,255,0.15)' : '#0f0f1a',
              border: demoEnabled ? '1px solid rgba(0,212,255,0.4)' : '1px solid #1a1a2e',
              color: demoEnabled ? '#00d4ff' : '#8a8ab0',
              transition: 'all 150ms ease',
              cursor: 'pointer',
              boxShadow: demoEnabled ? '0 0 12px rgba(0,212,255,0.25)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!demoEnabled) {
                e.currentTarget.style.color = '#00d4ff'
                e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'
                e.currentTarget.style.background = 'rgba(0,212,255,0.08)'
              }
            }}
            onMouseLeave={(e) => {
              if (!demoEnabled) {
                e.currentTarget.style.color = '#8a8ab0'
                e.currentTarget.style.borderColor = '#1a1a2e'
                e.currentTarget.style.background = '#0f0f1a'
              }
            }}
          >
            <Clapperboard size={15} />
          </button>
        )}

        {/* Keyboard shortcuts */}
        <span className="hide-mobile">
          <ShortcutsButton onToggleDemoMode={onToggleDemo} />
        </span>

        {/* LIVE badge */}
        <div
          id="connection-status"
          role="status"
          aria-label={connected ? 'WebSocket connected' : 'WebSocket disconnected'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.65rem',
            borderRadius: 999,
            background: connected ? 'rgba(0,255,157,0.1)' : 'rgba(255,68,102,0.1)',
            border: `1px solid ${connected ? 'rgba(0,255,157,0.3)' : 'rgba(255,68,102,0.3)'}`,
            fontSize: '0.72rem',
            fontWeight: 700,
            color: connected ? '#00ff9d' : '#ff4466',
            letterSpacing: '0.06em',
            transition: 'all 250ms ease',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: connected ? '#00ff9d' : '#ff4466',
              boxShadow: connected ? '0 0 8px rgba(0,255,157,0.6)' : '0 0 8px rgba(255,68,102,0.6)',
              animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }}
          />
          {connected ? 'LIVE' : 'OFFLINE'}
        </div>

        {/* Settings icon */}
        <button
          id="btn-settings"
          aria-label="Settings"
          title="Settings"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f0f1a',
            border: '1px solid #1a1a2e',
            color: '#8a8ab0',
            transition: 'all 150ms ease',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1a1a2e'
            e.currentTarget.style.color = '#e8e8f0'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#0f0f1a'
            e.currentTarget.style.color = '#8a8ab0'
          }}
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  )
}

Header.propTypes = {
  connected:    PropTypes.bool.isRequired,
  demoEnabled:  PropTypes.bool,
  onToggleDemo: PropTypes.func,
  activeNav:    PropTypes.string,
  onNavChange:  PropTypes.func,
  alertCount:   PropTypes.number,
}

Header.defaultProps = {
  demoEnabled:  false,
  onToggleDemo: null,
  activeNav:    'dashboard',
  onNavChange:  null,
  alertCount:   0,
}

export default Header
