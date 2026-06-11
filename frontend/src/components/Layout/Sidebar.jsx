/**
 * @fileoverview Sidebar navigation component for OrbitalWatch.
 * F3 update: nav items trigger view changes, alert count badge, WS connection status.
 */

import { useState } from 'react'
import PropTypes from 'prop-types'


// ── Icon SVGs ──────────────────────────────────────────────────────────────────

const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
)

// ── Sidebar Component ─────────────────────────────────────────────────────────

/**
 * Sidebar navigation panel.
 *
 * @param {{
 *   activeNav: string,
 *   onNavChange: (id: string) => void,
 *   alertCount?: number,
 *   connected?: boolean,
 * }} props
 * @returns {JSX.Element}
 */
function Sidebar({ activeNav, onNavChange, alertCount, connected }) {

  const [hovered, setHovered] = useState(/** @type {string|null} */ (null))

  /** @type {{ id: string, label: string, icon: () => JSX.Element, view: string }[]} */
  const NAV_LINKS = [
    { id: 'dashboard', label: 'Dashboard',  icon: IconDashboard, view: 'globe' },
    { id: 'alerts',    label: 'Alerts',     icon: IconAlert,     view: 'alerts' },
  ]

  return (
    <aside
      id="sidebar"
      style={{
        width: 'var(--sidebar-width)',
        minHeight: '100vh',
        background: 'var(--space-card)',
        borderRight: '1px solid var(--space-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
        overflowY: 'auto',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────────── */}
      <div style={{ padding: '1.5rem 1.25rem 1rem', borderBottom: '1px solid var(--space-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <img
            src="/logo.png"
            alt="OrbitalWatch Logo"
            style={{
              width: 36,
              height: 36,
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
          <div>
            <h1
              style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}
              className="gradient-text"
            >
              OrbitalWatch
            </h1>
            <p style={{ fontSize: '0.6875rem', color: 'var(--space-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
              Space Situational Awareness
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────────── */}
      <nav aria-label="Primary navigation" style={{ padding: '0.75rem 0.75rem', flex: 1 }}>
        <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--space-text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.5rem 0.5rem 0.75rem' }}>
          Navigation
        </p>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {NAV_LINKS.map(({ id, label, icon: Icon }) => {
            const isActive  = activeNav === id
            const isHovered = hovered === id
            const showBadge = id === 'alerts' && alertCount > 0

            return (
              <li key={id}>
                <button
                  id={`nav-${id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavChange?.(id)}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--space-cyan)' : isHovered ? 'var(--space-text)' : 'var(--space-text-muted)',
                    background: isActive ? 'var(--space-cyan-dim)' : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: isActive ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
                    transition: 'all var(--transition-fast)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.7 }}>
                    <Icon />
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>

                  {/* Alert count badge */}
                  {showBadge && (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 999,
                        background: 'rgba(255,77,77,0.2)',
                        color: '#ff4d4d',
                        border: '1px solid rgba(255,77,77,0.4)',
                        minWidth: 20,
                        textAlign: 'center',
                        animation: 'pulse-dot 2s ease-in-out infinite',
                      }}
                    >
                      {alertCount > 99 ? '99+' : alertCount}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>


      </nav>

      {/* ── Status Footer ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--space-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--space-text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
          System
        </p>

        {/* WebSocket connection status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
          }}
        >
          <span style={{ color: 'var(--space-text-muted)' }}>Live Stream</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: connected ? 'var(--space-green)' : 'var(--space-red)',
                boxShadow: connected ? 'var(--glow-green)' : 'var(--glow-red)',
                animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
              }}
            />
            <span
              style={{
                color: connected ? 'var(--space-green)' : 'var(--space-red)',
                fontWeight: 500,
                fontSize: '0.75rem',
              }}
            >
              {connected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

        {[
          { label: 'TLE Data', status: 'Updated', color: 'var(--space-green)' },
          { label: 'API Server', status: 'Standby', color: 'var(--space-amber)' },
        ].map(({ label, status, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--space-text-muted)' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                  animation: 'pulse-dot 2s ease-in-out infinite',
                }}
              />
              <span style={{ color, fontWeight: 500, fontSize: '0.75rem' }}>{status}</span>
            </div>
          </div>
        ))}

        <p style={{ fontSize: '0.6875rem', color: 'var(--space-text-dim)', marginTop: '0.25rem' }}>
          v1.0.0 — OrbitalWatch
        </p>
      </div>
    </aside>
  )
}

Sidebar.propTypes = {
  /** Currently active navigation item id */
  activeNav: PropTypes.string,
  /** Called when a nav item is clicked */
  onNavChange: PropTypes.func,
  /** Number of active conjunction alerts — shows badge on Alerts nav item */
  alertCount: PropTypes.number,
  /** Whether the WebSocket is connected */
  connected: PropTypes.bool,
}

Sidebar.defaultProps = {
  activeNav:  'dashboard',
  onNavChange: null,
  alertCount:  0,
  connected:   false,
}

export default Sidebar
