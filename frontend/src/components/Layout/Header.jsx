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
  const { setSelectedSatellite, filters, setFilters, satellites } = useAppContext()

  const handleSearchSelect = (sat) => {
    setSelectedSatellite(sat)
    setMenuOpen(false)
    window.dispatchEvent(new CustomEvent('ow:demo-select-satellite'))
  }

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Globe', icon: IconDashboard },
    { id: 'alerts', label: 'Alerts', icon: IconAlert },
    { id: 'simulator', label: 'Launch Simulator', icon: Rocket },
  ]

  return (
    <header
      id="main-header"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        minHeight: 'var(--header-height)',
        height: menuOpen ? 'auto' : 'var(--header-height)',
        background: 'rgba(5, 5, 12, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid #1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999999,
        transition: 'height 250ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── Top Bar Row ────────────────────────────────────────────────────────── */}
      <div
        className="header-top-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 'var(--header-height)',
          padding: '0 1.5rem',
          gap: '1rem',
          width: '100%',
          boxSizing: 'border-box',
          flexShrink: 0,
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
            className="logo-title hide-xs"
            style={{
              fontSize: 'clamp(0.85rem, 1.4vw, 1.0625rem)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #00d4ff, #00ff9d)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              whiteSpace: 'nowrap',
            }}
          >
            OrbitalWatch
          </span>
        </div>

        {/* ── Center Nav ─────────────────────────────────────────────────────────── */}
        <nav className="header-nav" aria-label="Primary navigation" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.15rem, 0.4vw, 0.25rem)', marginLeft: 'clamp(0.5rem, 1vw, 1rem)', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeNav === id
            const isHovered = hoveredNav === id
            const showBadge = id === 'alerts' && alertCount > 0
            return (
              <button
                key={id}
                id={`nav-${id}`}
                className="hide-mobile nav-item-btn"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavChange?.(id)}
                onMouseEnter={() => setHoveredNav(id)}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem clamp(0.4rem, 0.8vw, 0.75rem)',
                  borderRadius: '8px',
                  fontSize: 'clamp(0.72rem, 1vw, 0.8125rem)',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#00d4ff' : isHovered ? '#e8e8f0' : '#8888aa',
                  background: isActive ? 'rgba(0,212,255,0.12)' : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: isActive ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
                  transition: 'all 150ms ease',
                  cursor: 'pointer',
                  position: 'relative',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon />
                <span>{label}</span>
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
        </nav>

        {/* ── Search Bar (Outside nav container so position: absolute dropdown is not clipped) ── */}
        <div className="header-search-container hide-mobile" style={{ marginLeft: '0.5rem', flex: '1 1 auto', maxWidth: '340px', minWidth: '120px', position: 'relative', zIndex: 1005 }}>
          <SearchBar onSelect={handleSearchSelect} satellites={satellites} />
        </div>

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
      </div>

      {/* ── Mobile/Medium Devices Navigation In-Flow Dropdown ──────────────────────── */}
      {menuOpen && (
        <div
          className="mobile-nav-dropdown"
          style={{
            position: 'relative',
            width: '100%',
            maxHeight: 'calc(100vh - var(--header-height) - 64px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: 'rgba(5, 5, 12, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(0, 212, 255, 0.15)',
            borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            padding: '1.25rem',
            gap: '1rem',
            boxSizing: 'border-box',
            zIndex: 999,
            animation: 'slideDownFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {/* Search Bar for Mobile & Desktop */}
          <div style={{ width: '100%', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a5a80', display: 'block', marginBottom: '0.375rem' }}>
              Search Catalog
            </span>
            <SearchBar onSelect={handleSearchSelect} satellites={satellites} />
          </div>

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

          {/* ── Mobile Quick Filters Section ───────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a5a80' }}>
                Filter Satellites
              </span>
              <button
                type="button"
                onClick={() => setFilters?.({ types: ['payload', 'debris', 'rocket body', 'unknown'], minAltitude: 0, maxAltitude: 40000 })}
                style={{ fontSize: '0.65rem', color: '#00d4ff', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Reset All
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {[
                { type: 'payload', label: 'Payloads', color: '#00ff9d' },
                { type: 'debris', label: 'Debris', color: '#ff4d4d' },
                { type: 'rocket body', label: 'Rocket Stage', color: '#ff9d00' },
                { type: 'unknown', label: 'Unknown', color: '#888888' },
              ].map(({ type, label, color }) => {
                const activeTypes = filters?.types ?? ['payload', 'debris', 'rocket body', 'unknown']
                const isActive = activeTypes.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      const next = isActive
                        ? activeTypes.filter((t) => t !== type)
                        : [...activeTypes, type]
                      setFilters?.({ ...(filters || {}), types: next })
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: isActive ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                      border: isActive ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      color: isActive ? '#00d4ff' : '#8888aa',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: isActive ? `0 0 6px ${color}` : 'none' }} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{isActive ? 'ON' : 'OFF'}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Quick Actions / System Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a5a80', marginBottom: 2 }}>
              System & Actions
            </span>

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
  connected: PropTypes.bool.isRequired,
  demoEnabled: PropTypes.bool,
  onToggleDemo: PropTypes.func,
  activeNav: PropTypes.string,
  onNavChange: PropTypes.func,
  alertCount: PropTypes.number,
}

Header.defaultProps = {
  demoEnabled: false,
  onToggleDemo: null,
  activeNav: 'dashboard',
  onNavChange: null,
  alertCount: 0,
}

export default Header
