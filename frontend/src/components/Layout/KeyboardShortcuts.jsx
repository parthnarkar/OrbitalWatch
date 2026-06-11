/**
 * @fileoverview KeyboardShortcuts — global keyboard shortcut system + cheat sheet modal.
 * Provides useKeyboardShortcuts() hook and ShortcutsButton component.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import PropTypes from 'prop-types'
import { useAppContext } from '../../context/AppContext.jsx'

// ── Focus Trap utility ────────────────────────────────────────────────────────

/**
 * Trap Tab/Shift-Tab focus within a container.
 * @param {HTMLElement | null} container
 */
function useFocusTrap(container) {
  useEffect(() => {
    if (!container) return

    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const trap = (e) => {
      if (e.key !== 'Tab') return
      const focusable = Array.from(container.querySelectorAll(FOCUSABLE))
      if (!focusable.length) return
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }

    container.addEventListener('keydown', trap)
    // Focus first element on open
    const firstFocusable = container.querySelector(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()

    return () => container.removeEventListener('keydown', trap)
  }, [container])
}

// ── SHORTCUTS MAP ─────────────────────────────────────────────────────────────

/** @type {{ key: string, description: string }[]} */
export const SHORTCUTS = [
  { key: '/',      description: 'Focus search bar' },
  { key: 'g',      description: 'Switch to Globe view' },
  { key: 'a',      description: 'Switch to Alerts view' },
  { key: 'f',      description: 'Follow selected satellite' },
  { key: 'd',      description: 'Toggle Demo Mode' },
  { key: 'Escape', description: 'Close panel / modal' },
  { key: '?',      description: 'Show this cheat sheet' },
]

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Register global keyboard shortcuts.
 *
 * @param {{
 *   onToggleDemoMode: () => void,
 *   onOpenShortcuts: () => void,
 * }} options
 */
export function useKeyboardShortcuts({ onToggleDemoMode, onOpenShortcuts }) {
  const { setActiveNav, setActiveAlert, selectedSatellite } = useAppContext()

  const handler = useCallback(
    (e) => {
      // Skip when typing in an input / textarea / select
      const tag = document.activeElement?.tagName ?? ''
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
        document.activeElement?.isContentEditable

      if (inInput && e.key !== 'Escape') return

      switch (e.key) {
        case '/':
          e.preventDefault()
          document.getElementById('search-input')?.focus() ||
            document.getElementById('header-search')?.focus()
          break

        case 'g':
          e.preventDefault()
          setActiveNav('dashboard')
          break

        case 'a':
          e.preventDefault()
          setActiveNav('alerts')
          break

        case 'f':
          if (selectedSatellite) {
            e.preventDefault()
            window.dispatchEvent(
              new CustomEvent('ow:follow-satellite', { detail: { satellite: selectedSatellite } })
            )
          }
          break

        case 'd':
          e.preventDefault()
          onToggleDemoMode?.()
          break

        case 'Escape':
          setActiveAlert(null)
          window.dispatchEvent(new CustomEvent('ow:close-all'))
          break

        case '?':
          e.preventDefault()
          onOpenShortcuts?.()
          break

        default:
          break
      }
    },
    [setActiveNav, setActiveAlert, selectedSatellite, onToggleDemoMode, onOpenShortcuts]
  )

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}

// ── Cheat Sheet Modal ─────────────────────────────────────────────────────────

/**
 * Keyboard shortcuts cheat sheet modal with focus trap.
 * @param {{ onClose: () => void }} props
 */
function ShortcutsModal({ onClose }) {
  const containerRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  useFocusTrap(containerRef.current)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 300,
          animation: 'fadeIn 0.2s ease forwards',
        }}
      />

      {/* Modal */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 420,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: '#0a0a12',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 16,
          padding: '1.5rem',
          zIndex: 301,
          animation: 'fadeIn 0.2s ease forwards',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.08)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8888aa', marginBottom: 4 }}>
              Keyboard Shortcuts
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#e8e8f0' }}>
              Quick Reference
            </div>
          </div>
          <button
            id="shortcuts-close"
            aria-label="Close shortcuts"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8888aa',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Shortcut rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {SHORTCUTS.map(({ key, description }) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                borderBottom: '1px solid rgba(26,26,46,0.8)',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: '#8888aa' }}>{description}</span>
              <kbd
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 32,
                  padding: '0.2rem 0.5rem',
                  background: 'rgba(0,212,255,0.08)',
                  border: '1px solid rgba(0,212,255,0.25)',
                  borderRadius: 6,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#00d4ff',
                }}
              >
                {key === 'Escape' ? 'Esc' : key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

ShortcutsModal.propTypes = {
  onClose: PropTypes.func.isRequired,
}

// ── Help Button ───────────────────────────────────────────────────────────────

/**
 * A "?" button that opens the shortcuts cheat sheet modal.
 * Intended to be placed in the Header.
 *
 * @param {{ onToggleDemoMode?: () => void }} props
 * @returns {JSX.Element}
 */
function ShortcutsButton({ onToggleDemoMode }) {
  const [open, setOpen] = useState(false)

  useKeyboardShortcuts({
    onToggleDemoMode,
    onOpenShortcuts: () => setOpen(true),
  })

  return (
    <>
      <button
        id="btn-shortcuts-help"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        onClick={() => setOpen(true)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--space-card)',
          border: '1px solid var(--space-border)',
          color: 'var(--space-text-muted)',
          fontSize: '0.9rem',
          fontWeight: 700,
          transition: 'all var(--transition-fast)',
          cursor: 'pointer',
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
        ?
      </button>

      {open && <ShortcutsModal onClose={() => setOpen(false)} />}
    </>
  )
}

ShortcutsButton.propTypes = {
  /** Callback to toggle demo mode, passed to the keyboard shortcut handler */
  onToggleDemoMode: PropTypes.func,
}

ShortcutsButton.defaultProps = {
  onToggleDemoMode: null,
}

export { ShortcutsModal, ShortcutsButton }
export default ShortcutsButton
