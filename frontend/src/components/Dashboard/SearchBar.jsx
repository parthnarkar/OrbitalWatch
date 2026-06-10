/**
 * @fileoverview SearchBar — satellite search with debounce, dropdown, and keyboard navigation.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Search } from 'lucide-react'
import { searchSatellites } from '../../services/api.js'

// ── Type Badge ─────────────────────────────────────────────────────────────────

/** @param {{ type: string }} props */
function TypeBadge({ type }) {
  const t = (type || '').toLowerCase()
  const config = {
    payload:     { bg: 'rgba(0,255,157,0.15)', color: '#00ff9d', border: 'rgba(0,255,157,0.3)' },
    debris:      { bg: 'rgba(255,68,102,0.15)', color: '#ff4466', border: 'rgba(255,68,102,0.3)' },
    'rocket body':{ bg: 'rgba(255,187,51,0.15)', color: '#ffbb33', border: 'rgba(255,187,51,0.3)' },
  }
  const style = config[t] ?? { bg: 'rgba(136,136,170,0.15)', color: '#8888aa', border: 'rgba(136,136,170,0.3)' }

  return (
    <span
      style={{
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '0.15rem 0.5rem',
        borderRadius: 999,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {type || 'Unknown'}
    </span>
  )
}

TypeBadge.propTypes = { type: PropTypes.string }

// ── SearchBar Component ────────────────────────────────────────────────────────

/**
 * Satellite search bar with debounced API calls, scrollable dropdown,
 * keyboard navigation (ArrowUp/Down, Enter, Escape), and type badges.
 *
 * @param {{ onSelect: (satellite: Object) => void }} props
 * @returns {JSX.Element}
 */
function SearchBar({ onSelect }) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState(/** @type {Object[]} */ ([]))
  const [loading, setLoading]       = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const inputRef    = useRef(/** @type {HTMLInputElement|null} */ (null))
  const dropdownRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  const debounceRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null))

  // ── Debounced search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      setShowDropdown(false)
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchSatellites(query)
        setResults(Array.isArray(data) ? data : [])
        setShowDropdown(true)
        setSelectedIndex(-1)
      } catch (err) {
        console.error('[SearchBar] search error:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current   && !inputRef.current.contains(e.target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (!showDropdown || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      inputRef.current?.blur()
    }
  }, [showDropdown, results, selectedIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((sat) => {
    onSelect?.(sat)
    setQuery('')
    setResults([])
    setShowDropdown(false)
    setSelectedIndex(-1)
  }, [onSelect])

  // ── Scroll selected item into view ──────────────────────────────────────────
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  return (
    <div
      id="satellite-search-bar"
      style={{ position: 'relative', width: '100%', maxWidth: 520 }}
    >
      {/* ── Input ───────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '0.875rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: loading ? 'var(--space-cyan)' : 'var(--space-text-muted)',
            display: 'flex',
            alignItems: 'center',
            transition: 'color var(--transition-fast)',
            pointerEvents: 'none',
          }}
        >
          <Search size={16} />
        </span>

        <input
          id="search-input"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search satellite (e.g., ISS, Hubble, Starlink-1234)..."
          autoComplete="off"
          aria-label="Search satellites"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          style={{
            width: '100%',
            paddingLeft: '2.5rem',
            paddingRight: '1rem',
            height: '42px',
            background: '#0f0f1a',
            border: '1px solid #1a1a2e',
            borderRadius: '0.5rem',
            color: 'var(--space-text)',
            fontSize: '0.875rem',
            outline: 'none',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = 'var(--space-cyan)'
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,212,255,0.15)'
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = '#1a1a2e'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />

        {/* Loading spinner */}
        {loading && (
          <span
            aria-label="Searching…"
            style={{
              position: 'absolute',
              right: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 14,
              height: 14,
              border: '2px solid var(--space-border-bright)',
              borderTopColor: 'var(--space-cyan)',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
        )}
      </div>

      {/* ── Dropdown ────────────────────────────────────────────────────────── */}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Search results"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            maxHeight: 300,
            overflowY: 'auto',
            background: '#0f0f1a',
            border: '1px solid #1a1a2e',
            borderRadius: '0.5rem',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.08)',
            zIndex: 200,
          }}
        >
          {results.map((sat, idx) => {
            const isActive = idx === selectedIndex
            return (
              <button
                key={sat.norad_id ?? idx}
                data-index={idx}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(sat)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  background: isActive ? 'rgba(0,212,255,0.08)' : 'transparent',
                  borderBottom: '1px solid rgba(26,26,46,0.6)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background var(--transition-fast)',
                  borderLeft: isActive ? '2px solid var(--space-cyan)' : '2px solid transparent',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: isActive ? 'var(--space-text)' : 'var(--space-text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sat.name ?? '—'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: 'var(--space-cyan)',
                      marginTop: 1,
                    }}
                  >
                    #{sat.norad_id ?? '—'}
                  </div>
                </div>
                <TypeBadge type={sat.object_type ?? sat.type} />
              </button>
            )
          })}
        </div>
      )}

      {/* No results state */}
      {showDropdown && !loading && results.length === 0 && query.trim() && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#0f0f1a',
            border: '1px solid #1a1a2e',
            borderRadius: '0.5rem',
            padding: '1rem',
            textAlign: 'center',
            color: 'var(--space-text-dim)',
            fontSize: '0.8rem',
            zIndex: 200,
          }}
        >
          No satellites found for &ldquo;{query}&rdquo;
        </div>
      )}

      {/* spin animation (injected once) */}
      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  )
}

SearchBar.propTypes = {
  /** Called with the selected satellite object when user picks a result */
  onSelect: PropTypes.func,
}

SearchBar.defaultProps = {
  onSelect: null,
}

export default SearchBar
