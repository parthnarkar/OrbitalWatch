/**
 * @fileoverview Header component — top bar with search and connection status.
 */

import PropTypes from 'prop-types'
import { Clapperboard } from 'lucide-react'
import OrbitalClock from '../Dashboard/OrbitalClock.jsx'
import ShortcutsButton from './KeyboardShortcuts.jsx'




// ── Header Component ──────────────────────────────────────────────────────────

/**
 * @param {{ connected: boolean, onResetCamera?: Function, demoEnabled?: boolean, onToggleDemo?: Function }} props
 * @returns {JSX.Element}
 */
function Header({ connected, demoEnabled, onToggleDemo }) {

  return (
    <header
        id="main-header"
        style={{
          height: 'var(--header-height)',
          background: 'rgba(5, 5, 8, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--space-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1.5rem',
          gap: '1rem',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Spacer to push actions to the right */}
        <div style={{ flex: 1 }} />

        {/* ── Right Side Actions ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="hide-xs" style={{ display: 'flex', alignItems: 'center' }}>
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
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: demoEnabled ? 'rgba(0,212,255,0.15)' : 'var(--space-card)',
                border: demoEnabled ? '1px solid rgba(0,212,255,0.4)' : '1px solid var(--space-border)',
                color: demoEnabled ? 'var(--space-cyan)' : 'var(--space-text-muted)',
                transition: 'all var(--transition-fast)',
                cursor: 'pointer',
                boxShadow: demoEnabled ? 'var(--glow-cyan)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!demoEnabled) {
                  e.currentTarget.style.color = 'var(--space-cyan)'
                  e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (!demoEnabled) {
                  e.currentTarget.style.color = 'var(--space-text-muted)'
                  e.currentTarget.style.borderColor = 'var(--space-border)'
                }
              }}
            >
              <Clapperboard size={16} />
            </button>
          )}

          {/* Keyboard shortcuts help */}
          <span className="hide-mobile">
            <ShortcutsButton onToggleDemoMode={onToggleDemo} />
          </span>



          {/* Connection status badge */}
          <div
            id="connection-status"
            role="status"
            aria-label={connected ? 'WebSocket connected' : 'WebSocket disconnected'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.75rem',
              borderRadius: 999,
              background: connected ? 'var(--space-green-dim)' : 'var(--space-red-dim)',
              border: `1px solid ${connected ? 'rgba(0,255,157,0.3)' : 'rgba(255,68,102,0.3)'}`,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: connected ? 'var(--space-green)' : 'var(--space-red)',
              transition: 'all var(--transition-base)',
              letterSpacing: '0.04em',
            }}
          >
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
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </header>
  )
}

Header.propTypes = {
  connected:      PropTypes.bool.isRequired,
  demoEnabled:    PropTypes.bool,
  onToggleDemo:   PropTypes.func,
}

Header.defaultProps = {
  demoEnabled:   false,
  onToggleDemo:  null,
}

export default Header
