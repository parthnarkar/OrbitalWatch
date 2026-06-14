/**
 * @fileoverview Header component — sticky top bar with logo, clock, LIVE badge, nav.
 * Redesigned: OrbitalWatch logo on left, UTC clock center-right, LIVE badge + settings on far right.
 */

import { useState } from 'react'
import PropTypes from 'prop-types'
import { Clapperboard, Menu, X, Rocket } from 'lucide-react'
import { useAppContext } from '../../context/AppContext.jsx'
import SearchBar from '../Dashboard/SearchBar.jsx'
import OrbitalClock from '../Dashboard/OrbitalClock.jsx'
import { ShortcutsModal } from './KeyboardShortcuts.jsx'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { setSelectedSatellite, simOpen, setSimOpen, setActiveNav } = useAppContext()

  const handleSearchSelect = (sat) => {
    setSelectedSatellite(sat)
    setMenuOpen(false)
  }

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Globe',            icon: IconDashboard },
    { id: 'alerts',    label: 'Alerts',           icon: IconAlert },
    { id: 'simulator', label: 'Launch Simulator', icon: Rocket },
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
        zIndex: 1000,
      }}
    >
      {/* ── Left: Logo ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
        <img
          src="/logo.png"
          alt="OrbitalWatch Logo"
          style={{
            width: 32,
            height: 32,
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />
        <span
          className="hide-xs"
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
      <nav className="header-nav" aria-label="Primary navigation" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '1.5rem', flex: '1 1 auto', minWidth: 0 }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeNav === id
          const isHovered = hoveredNav === id
          const showBadge = id === 'alerts' && alertCount > 0
          return (
            <button
              key={id}
              id={`nav-${id}`}
              className="hide-mobile"
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
          <div style={{ marginLeft: '0.5rem', flex: '1 1 auto', maxWidth: '280px', minWidth: '80px' }}>
            <SearchBar onSelect={handleSearchSelect} />
          </div>
        )}
      </nav>

      {/* ── Spacer ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Right Side Actions ──────────────────────────────────────────────────── */}
      <div className="header-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>

        {/* Demo Mode toggle */}
        {onToggleDemo && (
          <button
            id="btn-demo-mode"
            className="hide-xs"
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
          <span className="hide-xs">{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>



        {/* Hamburger Menu Toggle (visible only on medium screens and lower) */}
        <button
          id="btn-hamburger"
          className="hamburger-toggle"
          aria-label="Toggle Navigation Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            display: 'none', /* overridden by media query */
            alignItems: 'center',
            justifyContent: 'center',
            background: menuOpen ? 'rgba(0, 212, 255, 0.15)' : '#0f0f1a',
            border: menuOpen ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid #1a1a2e',
            color: menuOpen ? '#00d4ff' : '#8a8ab0',
            transition: 'all 150ms ease',
            cursor: 'pointer',
          }}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile/Medium Devices Navigation Dropdown Overlay ─────────────────────── */}
      {menuOpen && (
        <div
          className="mobile-nav-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'rgba(5, 5, 12, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.9), 0 4px 12px rgba(0, 212, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            padding: '1.25rem',
            gap: '1rem',
            zIndex: 9999,
            animation: 'slideDownFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {/* Nav items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a5a80', marginBottom: 2 }}>
              Navigation
            </span>
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeNav === id
              const showBadge = id === 'alerts' && alertCount > 0
              return (
                <button
                  key={id}
                  onClick={() => {
                    onNavChange?.(id)
                    setMenuOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#00d4ff' : '#e8e8f0',
                    background: isActive ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.02)',
                    border: isActive ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <Icon />
                  <span style={{ flex: 1 }}>{label}</span>
                  {showBadge && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: 999,
                        background: 'rgba(255,77,77,0.2)',
                        color: '#ff4d4d',
                        border: '1px solid rgba(255,77,77,0.4)',
                        minWidth: 20,
                        textAlign: 'center',
                      }}
                    >
                      {alertCount}
                    </span>
                  )}
                </button>
              )
            })}


          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Quick Actions / System Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a5a80', marginBottom: 2 }}>
              System & Actions
            </span>

            {/* Shortcuts trigger */}
            <button
              onClick={() => {
                setMenuOpen(false)
                setShortcutsOpen(true)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 0.875rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: '#8a8ab0',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span style={{ fontSize: '1rem' }}>⌨</span>
              <span>Keyboard Shortcuts</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#5a5a80', padding: '0.1rem 0.3rem', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>?</span>
            </button>

            {/* Demo mode row inside menu */}
            {onToggleDemo && (
              <button
                onClick={() => {
                  onToggleDemo()
                  setMenuOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: demoEnabled ? '#00d4ff' : '#8a8ab0',
                  background: demoEnabled ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
                  border: demoEnabled ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <Clapperboard size={15} />
                <span>Demo Mode</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, color: demoEnabled ? '#00d4ff' : '#8a8ab0' }}>
                  {demoEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            )}

            {/* Mobile status & clock row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0.5rem', marginTop: '0.25rem' }}>
              {/* UTC Clock */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.05em', color: '#5a5a80', textTransform: 'uppercase' }}>System UTC Time</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#8a8ab0' }}>
                  <OrbitalClock />
                </span>
              </div>

              {/* Status */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.05em', color: '#5a5a80', textTransform: 'uppercase' }}>Network</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: connected ? '#00ff9d' : '#ff4466', fontSize: '0.75rem', fontWeight: 700 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#00ff9d' : '#ff4466' }} />
                  {connected ? 'LIVE' : 'OFFLINE'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
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
