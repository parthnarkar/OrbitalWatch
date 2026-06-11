/**
 * @fileoverview MobileSheet — responsive bottom-sheet navigation for small screens.
 * CSS-driven (media queries, no JS width check) for SSR safety.
 * All tap targets are min 44×44px per WCAG 2.1 2.5.5.
 */

import PropTypes from 'prop-types'
import { useAppContext } from '../../context/AppContext.jsx'

// ── Mobile nav items ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Globe',   emoji: '🌍' },
  { id: 'alerts',    label: 'Alerts',  emoji: '⚠️' },
]

// ── MobileSheet Component ─────────────────────────────────────────────────────

/**
 * A bottom-sheet nav bar that only appears on mobile (< 768px).
 * Uses CSS `display:none` on larger breakpoints so the sidebar is shown instead.
 *
 * @param {{
 *   alertCount?: number,
 *   connected?: boolean,
 * }} props
 * @returns {JSX.Element}
 */
function MobileSheet({ alertCount }) {
  const { activeNav, setActiveNav } = useAppContext()

  return (
    <>
      {/* ── CSS that controls visibility ─────────────────────────────────────── */}
      <style>{`
        /* Only show on mobile */
        @media (min-width: 768px) {
          #mobile-sheet-bar { display: none !important; }
        }
        @media (max-width: 767px) {
          /* hide the desktop sidebar on mobile */
          #sidebar { display: none !important; }
          /* offset main area for bottom bar */
          #main-layout > div { margin-left: 0 !important; }
        }
      `}</style>

      {/* ── Bottom Nav Bar ─────────────────────────────────────────────────── */}
      <nav
        id="mobile-sheet-bar"
        aria-label="Mobile navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: 'rgba(10,10,18,0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--space-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 90,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {NAV_ITEMS.map(({ id, label, emoji }) => {
          const isActive = activeNav === id
          const showBadge = id === 'alerts' && alertCount > 0
          return (
            <button
              key={id}
              id={`mobile-nav-${id}`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveNav(id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                minWidth: 60,
                minHeight: 44,
                padding: '0.5rem 0.75rem',
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--space-cyan)' : 'var(--space-text-muted)',
                transition: 'color var(--transition-fast)',
              }}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{emoji}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: isActive ? 700 : 500, letterSpacing: '0.04em' }}>
                {label}
              </span>
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24,
                    height: 2,
                    borderRadius: 1,
                    background: 'var(--space-cyan)',
                    boxShadow: 'var(--glow-cyan)',
                  }}
                />
              )}
              {showBadge && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 8,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    background: '#ff4d4d',
                    color: 'white',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    boxShadow: '0 0 8px rgba(255,77,77,0.5)',
                  }}
                >
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </>
  )
}

MobileSheet.propTypes = {
  alertCount: PropTypes.number,
}

MobileSheet.defaultProps = {
  alertCount: 0,
}

export default MobileSheet
