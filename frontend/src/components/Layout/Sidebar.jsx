/**
 * @fileoverview Sidebar navigation component for OrbitalWatch.
 */

import { useState } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'

// ── Icon SVGs (inline, no external dependency needed for basic shapes) ────────

const IconSatellite = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
)

const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
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

// ── Nav Link Data ──────────────────────────────────────────────────────────────

/** @type {{ id: string, label: string, icon: () => JSX.Element, badge?: string }[]} */
const NAV_LINKS = [
  { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
  { id: 'alerts', label: 'Alerts', icon: IconAlert, badge: 'LIVE' },
  { id: 'satellites', label: 'Satellites', icon: IconSatellite },
  { id: 'search', label: 'Search', icon: IconSearch },
]

// ── Sidebar Component ─────────────────────────────────────────────────────────

/**
 * Sidebar navigation panel with logo, nav links, and system status.
 *
 * @param {{ activeNav?: string, onNavChange?: (id: string) => void }} props
 * @returns {JSX.Element}
 */
function Sidebar({ activeNav = 'dashboard', onNavChange }) {
  const { showDebrisOnly, setShowDebrisOnly } = useAppContext()
  const [hovered, setHovered] = useState(/** @type {string|null} */ (null))

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
      {/* ── Logo ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '1.5rem 1.25rem 1rem',
          borderBottom: '1px solid var(--space-border)',
        }}
      >
        {/* Orbital ring icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.25rem',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '2px solid var(--space-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: 'var(--glow-cyan)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--space-cyan)',
              }}
            />
            {/* Orbiting dot */}
            <div
              style={{
                position: 'absolute',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--space-green)',
                animation: 'orbit 3s linear infinite',
                boxShadow: 'var(--glow-green)',
              }}
            />
          </div>

          <div>
            <h1
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
              className="gradient-text"
            >
              OrbitalWatch
            </h1>
            <p
              style={{
                fontSize: '0.6875rem',
                color: 'var(--space-text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}
            >
              Space Situational Awareness
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav
        aria-label="Primary navigation"
        style={{ padding: '0.75rem 0.75rem', flex: 1 }}
      >
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--space-text-dim)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            padding: '0.5rem 0.5rem 0.75rem',
          }}
        >
          Navigation
        </p>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {NAV_LINKS.map(({ id, label, icon: Icon, badge }) => {
            const isActive = activeNav === id
            const isHovered = hovered === id

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
                    color: isActive
                      ? 'var(--space-cyan)'
                      : isHovered
                      ? 'var(--space-text)'
                      : 'var(--space-text-muted)',
                    background: isActive
                      ? 'var(--space-cyan-dim)'
                      : isHovered
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                    border: isActive
                      ? '1px solid rgba(0,212,255,0.2)'
                      : '1px solid transparent',
                    transition: 'all var(--transition-fast)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.7 }}>
                    <Icon />
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                  {badge && (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        padding: '0.15rem 0.4rem',
                        borderRadius: 999,
                        background: 'var(--space-green-dim)',
                        color: 'var(--space-green)',
                        border: '1px solid rgba(0,255,157,0.25)',
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div style={{ marginTop: '1.5rem' }}>
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--space-text-dim)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '0 0.5rem 0.75rem',
            }}
          >
            Filters
          </p>

          <label
            htmlFor="toggle-debris"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0.875rem',
              cursor: 'pointer',
              borderRadius: 'var(--radius-md)',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {/* Toggle switch */}
            <div
              id="toggle-debris"
              role="checkbox"
              aria-checked={showDebrisOnly}
              tabIndex={0}
              onClick={() => setShowDebrisOnly(!showDebrisOnly)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') setShowDebrisOnly(!showDebrisOnly)
              }}
              style={{
                width: 36,
                height: 20,
                borderRadius: 999,
                background: showDebrisOnly ? 'var(--space-cyan)' : 'var(--space-border-bright)',
                position: 'relative',
                transition: 'background var(--transition-base)',
                flexShrink: 0,
                boxShadow: showDebrisOnly ? 'var(--glow-cyan)' : 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  left: showDebrisOnly ? 18 : 3,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left var(--transition-base)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              />
            </div>
            <span
              style={{
                fontSize: '0.875rem',
                color: 'var(--space-text-muted)',
              }}
            >
              Debris Only
            </span>
          </label>
        </div>
      </nav>

      {/* ── Status Footer ────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--space-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--space-text-dim)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '0.25rem',
          }}
        >
          System
        </p>

        {[
          { label: 'TLE Data', status: 'Updated', color: 'var(--space-green)' },
          { label: 'API Server', status: 'Standby', color: 'var(--space-amber)' },
        ].map(({ label, status, color }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
            }}
          >
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

        <p
          style={{
            fontSize: '0.6875rem',
            color: 'var(--space-text-dim)',
            marginTop: '0.25rem',
          }}
        >
          v1.0.0 — OrbitalWatch
        </p>
      </div>
    </aside>
  )
}

export default Sidebar
