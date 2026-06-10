/**
 * @fileoverview DemoMode — auto-cycling demo presentation component.
 * Persists state in localStorage. Fires events to drive the globe & alerts.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useAppContext } from '../../context/AppContext.jsx'

const LS_KEY = 'ow:demo_mode'

// ── Demo Badge ────────────────────────────────────────────────────────────────

/** Pulsing badge shown in the top-left of the viewport when demo is active */
function DemoBadge() {
  return (
    <div
      id="demo-mode-badge"
      aria-live="polite"
      aria-label="Demo mode active"
      style={{
        position: 'fixed',
        top: 'calc(var(--header-height) + 12px)',
        left: 'calc(var(--sidebar-width) + 12px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.35rem 0.875rem',
        background: 'rgba(0,212,255,0.15)',
        border: '1px solid rgba(0,212,255,0.5)',
        borderRadius: 999,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#00d4ff',
          boxShadow: '0 0 10px #00d4ff',
          animation: 'pulse-cyan 1.5s ease-in-out infinite',
          display: 'inline-block',
        }}
      />
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#00d4ff',
        }}
      >
        Demo Mode
      </span>
    </div>
  )
}

// ── useDemoMode hook ──────────────────────────────────────────────────────────

/**
 * Manages demo mode state persistence and exposes toggle.
 * @returns {{ enabled: boolean, toggle: () => void }}
 */
export function useDemoMode() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === 'true' } catch { return false }
  })

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v
      try { localStorage.setItem(LS_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { enabled, toggle }
}

// ── DemoMode Component ────────────────────────────────────────────────────────

/**
 * When enabled, auto-rotates the globe and cycles through satellites / alerts.
 * Also shows the DemoBadge overlay.
 *
 * @param {{
 *   enabled: boolean,
 *   onToggle: () => void,
 *   satellites?: Object[],
 *   conjunctions?: Object[],
 * }} props
 */
function DemoMode({ enabled, onToggle, satellites, conjunctions }) {
  const { setSelectedSatellite, setActiveAlert, setActiveNav } = useAppContext()

  const satIndexRef  = useRef(0)
  const alertIndexRef = useRef(0)

  // ── Satellite cycling (every 5 s) ──────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !satellites?.length) return

    const cycle = () => {
      satIndexRef.current = (satIndexRef.current + 1) % satellites.length
      const sat = satellites[satIndexRef.current]
      setSelectedSatellite(sat ?? null)
      // Tell the globe to focus via event
      window.dispatchEvent(
        new CustomEvent('ow:demo-select-satellite', { detail: { norad_id: sat?.norad_id } })
      )
    }

    cycle() // kick immediately
    const id = setInterval(cycle, 5_000)
    return () => clearInterval(id)
  }, [enabled, satellites, setSelectedSatellite])

  // ── Alert cycling (every 10 s) ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !conjunctions?.length) return

    const cycle = () => {
      alertIndexRef.current = (alertIndexRef.current + 1) % conjunctions.length
      const alert = conjunctions[alertIndexRef.current]
      setActiveAlert(alert ?? null)
    }

    const id = setInterval(cycle, 10_000)
    return () => clearInterval(id)
  }, [enabled, conjunctions, setActiveAlert])

  // ── Auto-rotate globe signal ───────────────────────────────────────────────
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('ow:demo-auto-rotate', { detail: { enabled, speed: 2.0 } })
    )
  }, [enabled])

  // Cleanup: on disable, clear selections
  useEffect(() => {
    if (!enabled) {
      setSelectedSatellite(null)
      setActiveAlert(null)
    }
  }, [enabled, setSelectedSatellite, setActiveAlert])

  void onToggle   // consumed by parent (Header button)
  void setActiveNav // available if needed

  return enabled ? <DemoBadge /> : null
}

DemoMode.propTypes = {
  /** Whether demo mode is currently active */
  enabled: PropTypes.bool.isRequired,
  /** Toggle callback */
  onToggle: PropTypes.func.isRequired,
  /** Satellites list to cycle through */
  satellites: PropTypes.arrayOf(PropTypes.object),
  /** Conjunctions list to cycle through */
  conjunctions: PropTypes.arrayOf(PropTypes.object),
}

DemoMode.defaultProps = {
  satellites:   [],
  conjunctions: [],
}

export default DemoMode
