/**
 * @fileoverview SearchBar — satellite search with debounce, dropdown, keyboard navigation, and fallback catalog.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Search } from 'lucide-react'
import { searchSatellites } from '../../services/api.js'
import { useAppContext } from '../../context/AppContext.jsx'

// ── Built-in Fallback Catalog ──────────────────────────────────────────────────
// Ensures local search works immediately even before backend API or WebSocket finishes loading
const FALLBACK_CATALOG = [
  { norad_id: '25544', name: 'ISS (ZARYA)', object_type: 'payload', altitude_km: 418, country: 'US/RU' },
  { norad_id: '20580', name: 'HUBBLE SPACE TELESCOPE', object_type: 'payload', altitude_km: 538, country: 'US' },
  { norad_id: '48274', name: 'TIANGONG (CSS)', object_type: 'payload', altitude_km: 388, country: 'CN' },
  { norad_id: '44713', name: 'STARLINK-1007', object_type: 'payload', altitude_km: 550, country: 'US' },
  { norad_id: '44714', name: 'STARLINK-1008', object_type: 'payload', altitude_km: 550, country: 'US' },
  { norad_id: '28654', name: 'NOAA 18', object_type: 'payload', altitude_km: 854, country: 'US' },
  { norad_id: '25994', name: 'TERRA', object_type: 'payload', altitude_km: 705, country: 'US' },
  { norad_id: '33591', name: 'COSMOS 2251 DEBRIS', object_type: 'debris', altitude_km: 790, country: 'RU' },
  { norad_id: '33860', name: 'IRIDIUM 33 DEBRIS', object_type: 'debris', altitude_km: 775, country: 'US' },
  { norad_id: '40059', name: 'FALCON 9 R/B', object_type: 'rocket body', altitude_km: 620, country: 'US' },
  { norad_id: '37849', name: 'CZ-2D R/B', object_type: 'rocket body', altitude_km: 490, country: 'CN' },
  { norad_id: '90001', name: 'SYNTHETIC PAYLOAD 1', object_type: 'payload', altitude_km: 500, country: 'US' },
  { norad_id: '90002', name: 'SYNTHETIC DEBRIS 1', object_type: 'debris', altitude_km: 700, country: 'US' },
]

// ── Type Badge ─────────────────────────────────────────────────────────────────

/** @param {{ type: string }} props */
function TypeBadge({ type }) {
  const t = (type || '').toLowerCase()
  const config = {
    payload:      { bg: 'rgba(0,255,157,0.15)', color: '#00ff9d', border: 'rgba(0,255,157,0.3)' },
    debris:       { bg: 'rgba(255,68,102,0.15)', color: '#ff4466', border: 'rgba(255,68,102,0.3)' },
    'rocket body': { bg: 'rgba(255,187,51,0.15)', color: '#ffbb33', border: 'rgba(255,187,51,0.3)' },
    'rocket_body': { bg: 'rgba(255,187,51,0.15)', color: '#ffbb33', border: 'rgba(255,187,51,0.3)' },
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
 * Satellite search bar with instant local filtering + debounced API calls,
 * scrollable dropdown, keyboard navigation (ArrowUp/Down, Enter, Escape), and type badges.
 *
 * @param {{ onSelect?: (satellite: Object) => void, satellites?: Object[] }} props
 * @returns {JSX.Element}
 */
function SearchBar({ onSelect, satellites: propSatellites }) {
  const { positions = [], satellites: contextSatellites = [], setActiveNav } = useAppContext() ?? {}

  // Determine active catalog: prop -> context satellites -> positions -> fallback catalog
  const catalog = (propSatellites && propSatellites.length > 0)
    ? propSatellites
    : (contextSatellites && contextSatellites.length > 0)
      ? contextSatellites
      : (positions && positions.length > 0)
        ? positions
        : FALLBACK_CATALOG

  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState(/** @type {Object[]} */ ([]))
  const [loading, setLoading]       = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const inputRef    = useRef(/** @type {HTMLInputElement|null} */ (null))
  const dropdownRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  const debounceRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null))
  const catalogRef  = useRef(catalog)

  // Keep catalogRef updated with latest satellite array
  useEffect(() => {
    catalogRef.current = catalog
  }, [catalog])

  // ── Search filter execution ─────────────────────────────────────────────────
  const performSearch = useCallback((rawQuery) => {
    const trimmed = rawQuery.trim().toLowerCase()
    if (!trimmed) {
      setResults([])
      setShowDropdown(false)
      setLoading(false)
      return
    }

    // 1. Instant local search filtering over current catalog (0ms latency)
    const cat = catalogRef.current || FALLBACK_CATALOG
    const localMatches = cat.filter((s) => {
      const nameMatch = (s.name || '').toLowerCase().includes(trimmed)
      const noradMatch = String(s.norad_id || s.id || '').includes(trimmed)
      const intlMatch = (s.intl_designator || s.intl_desig || '').toLowerCase().includes(trimmed)
      const typeMatch = (s.object_type || s.type || '').toLowerCase().includes(trimmed)
      return nameMatch || noradMatch || intlMatch || typeMatch
    }).slice(0, 20)

    setResults(localMatches)
    setShowDropdown(true)

    // 2. Background API search for complete database matches
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchSatellites(rawQuery)
        const apiData = Array.isArray(data) ? data : []
        const map = new Map()
        localMatches.forEach((s) => map.set(String(s.norad_id || s.id || s.name), s))
        apiData.forEach((s) => map.set(String(s.norad_id || s.id || s.name), s))
        const merged = Array.from(map.values()).slice(0, 25)
        setResults(merged)
        setShowDropdown(true)
      } catch (err) {
        console.warn('[SearchBar] API search error:', err)
        // Keep local matches if API fails or backend is unreachable
        setResults(localMatches)
        setShowDropdown(true)
      } finally {
        setLoading(false)
      }
    }, 200)
  }, [])

  // ── Trigger search on query change ──────────────────────────────────────────
  useEffect(() => {
    performSearch(query)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, performSearch])

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

  const handleSelect = useCallback((sat) => {
    onSelect?.(sat)
    setActiveNav?.('dashboard')
    setQuery('')
    setResults([])
    setShowDropdown(false)
    setSelectedIndex(-1)
  }, [onSelect, setActiveNav])

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
      } else if (results.length > 0) {
        handleSelect(results[0])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      inputRef.current?.blur()
    }
  }, [showDropdown, results, selectedIndex, handleSelect])

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
          onFocus={() => {
            if (query.trim()) {
              setShowDropdown(true)
            }
          }}
          placeholder="Search satellite (e.g., ISS, Hubble, Starlink-1234)..."
          autoComplete="off"
          aria-label="Search satellites"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          style={{
            width: '100%',
            paddingLeft: '2.5rem',
            paddingRight: '24px',
            paddingTop: '12px',
            paddingBottom: '12px',
            background: '#0f0f1a',
            border: '1px solid #1a1a2e',
            borderRadius: '9999px',
            color: 'var(--space-text)',
            fontSize: 'clamp(0.75rem, 1.1vw, 0.875rem)',
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
            WebkitOverflowScrolling: 'touch',
            background: '#0f0f1a',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: '0.5rem',
            boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 20px rgba(0,212,255,0.15)',
            zIndex: 99999,
          }}
        >
          {results.map((sat, idx) => {
            const isActive = idx === selectedIndex
            return (
              <button
                key={sat.norad_id ?? sat.id ?? idx}
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
                    #{sat.norad_id ?? sat.id ?? '—'}
                  </div>
                </div>
                <TypeBadge type={sat.object_type ?? sat.type} />
              </button>
            )
          })}
        </div>
      )}

      {/* Searching / No results state */}
      {showDropdown && results.length === 0 && query.trim() && (
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
            zIndex: 99999,
          }}
        >
          {loading ? (
            <span style={{ color: 'var(--space-cyan)' }}>Searching satellite catalog…</span>
          ) : (
            <span>No satellites found for &ldquo;{query}&rdquo;</span>
          )}
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
  /** Optional array of satellites to override context catalog */
  satellites: PropTypes.array,
}

SearchBar.defaultProps = {
  onSelect: null,
  satellites: null,
}

export default SearchBar
