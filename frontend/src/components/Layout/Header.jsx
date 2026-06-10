/**
 * @fileoverview Header component — top bar with search and connection status.
 */

import { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { searchSatellites } from '../../services/api.js'
import { useAppContext } from '../../context/AppContext.jsx'
import OrbitalClock from '../Dashboard/OrbitalClock.jsx'

// ── Search Icon ───────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const BellIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

// ── Header Component ──────────────────────────────────────────────────────────

/**
 * @param {{ connected: boolean, onResetCamera?: Function }} props
 * @returns {JSX.Element}
 */
function Header({ connected, onResetCamera }) {
  const { activeAlert } = useAppContext()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Debounced search handler
  const handleSearch = useCallback(async (value) => {
    setQuery(value)
    if (!value.trim() || value.length < 2) {
      setResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    try {
      const data = await searchSatellites(value)
      setResults(Array.isArray(data) ? data.slice(0, 8) : [])
      setShowResults(true)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

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
      {/* ── Search ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, maxWidth: 480, position: 'relative' }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: '0.875rem',
              color: 'var(--space-text-muted)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <SearchIcon />
          </span>

          <input
            id="header-search"
            type="search"
            placeholder="Search satellites by name or NORAD ID…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            style={{
              width: '100%',
              paddingLeft: '2.5rem',
              paddingRight: '0.875rem',
              height: 40,
              background: 'var(--space-card)',
              border: '1px solid var(--space-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--space-text)',
              fontSize: '0.875rem',
              transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
              outline: 'none',
            }}
            onFocusCapture={(e) => {
              e.target.style.borderColor = 'var(--space-cyan)'
              e.target.style.boxShadow = '0 0 0 3px var(--space-cyan-dim)'
            }}
            onBlurCapture={(e) => {
              e.target.style.borderColor = 'var(--space-border)'
              e.target.style.boxShadow = 'none'
            }}
          />

          {searching && (
            <span
              style={{
                position: 'absolute',
                right: '0.875rem',
                color: 'var(--space-cyan)',
                fontSize: '0.75rem',
                animation: 'pulse-dot 1s ease-in-out infinite',
              }}
            >
              ···
            </span>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && results.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.5rem)',
              left: 0,
              right: 0,
              background: 'var(--space-card)',
              border: '1px solid var(--space-border-bright)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              zIndex: 100,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              animation: 'fadeIn 0.15s ease forwards',
            }}
          >
            {results.map((sat) => (
              <button
                key={sat.norad_id}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--space-border)',
                  transition: 'background var(--transition-fast)',
                  background: 'transparent',
                  color: 'var(--space-text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,212,255,0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span>{sat.name}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--space-text-muted)',
                    fontFamily: 'monospace',
                  }}
                >
                  #{sat.norad_id}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Right Side Actions ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <OrbitalClock />
        {/* Alert badge */}
        {activeAlert && (
          <div
            className="badge badge-red"
            style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
          >
            ⚠ Alert
          </div>
        )}

        {/* Reset Camera button */}
        {onResetCamera && (
          <button
            id="btn-reset-camera-header"
            aria-label="Reset camera view"
            onClick={onResetCamera}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.375rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--space-card)',
              border: '1px solid var(--space-border)',
              color: 'var(--space-text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--space-cyan)'
              e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--space-text-muted)'
              e.currentTarget.style.borderColor = 'var(--space-border)'
            }}
          >
            ↺ Reset Camera
          </button>
        )}

        {/* Notification bell */}
        <button
          id="btn-notifications"
          aria-label="View notifications"
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--space-text-muted)',
            background: 'var(--space-card)',
            border: '1px solid var(--space-border)',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--space-cyan)'
            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--space-text-muted)'
            e.currentTarget.style.borderColor = 'var(--space-border)'
          }}
        >
          <BellIcon />
        </button>

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
  connected: PropTypes.bool.isRequired,
  onResetCamera: PropTypes.func,
}

export default Header
