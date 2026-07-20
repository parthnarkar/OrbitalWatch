/**
 * @fileoverview RefreshButton — Triggers background conjunction updates and refetches telemetry.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { triggerRefresh } from '../../services/api.js'

// ── Refresh (rotate) icon ──────────────────────────────────────────────────

function RefreshIcon({ spinning }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        animation: spinning ? 'refresh-spin 0.9s linear infinite' : 'none',
      }}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

RefreshIcon.propTypes = { spinning: PropTypes.bool }
RefreshIcon.defaultProps = { spinning: false }

// ── Toast notification (local, self-dismissing) ───────────────────────────────

function RefreshToast({ message, variant, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const colors = {
    success: { bg: 'rgba(0,255,157,0.12)', border: 'rgba(0,255,157,0.4)', text: '#00ff9d' },
    error:   { bg: 'rgba(255,68,102,0.12)', border: 'rgba(255,68,102,0.4)', text: '#ff4466' },
    info:    { bg: 'rgba(0,212,255,0.12)',  border: 'rgba(0,212,255,0.4)',  text: '#00d4ff' },
  }
  const c = colors[variant] ?? colors.info

  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.875rem 1.125rem',
        background: 'rgba(10,10,18,0.98)',
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.text}`,
        borderRadius: 12,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.95), 0 0 20px rgba(0,212,255,0.2)',
        maxWidth: 360,
        width: 'calc(100vw - 32px)',
        pointerEvents: 'auto',
        animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: c.text,
          boxShadow: `0 0 8px ${c.text}`,
          flexShrink: 0,
          marginTop: 4,
        }}
      />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.8rem', color: '#e8e8f0', lineHeight: 1.5, margin: 0 }}>{message}</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          color: '#5a5a80',
          cursor: 'pointer',
          fontSize: '1rem',
          lineHeight: 1,
          padding: 0,
        }}
      >
        ✕
      </button>
    </div>,
    document.body
  )
}

RefreshToast.propTypes = {
  message:   PropTypes.string.isRequired,
  variant:   PropTypes.oneOf(['success', 'error', 'info']).isRequired,
  onDismiss: PropTypes.func.isRequired,
}

// ── Main RefreshButton component ──────────────────────────────────────────────

function RefreshButton({ onRefreshComplete }) {
  const [phase, setPhase] = useState('idle') // idle | refreshing | success | error
  const [hovered, setHovered] = useState(false)
  const [toast, setToast] = useState(null)
  const successRef = useRef(null)

  useEffect(() => {
    return () => {
      if (successRef.current) clearTimeout(successRef.current)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    if (phase !== 'idle' && phase !== 'error') return

    setPhase('refreshing')
    try {
      const result = await triggerRefresh()

      if (result && result.success) {
        setPhase('success')
        setToast({ message: result.message || 'Telemetry refresh initiated successfully.', variant: 'success' })

        // Notify parent context to update state immediately with fresh timestamp
        onRefreshComplete?.(result)

        // Return to idle after 2s
        successRef.current = setTimeout(() => {
          setPhase('idle')
        }, 2200)
      } else {
        setPhase('error')
        setToast({ message: result?.message || 'Refresh request failed.', variant: 'error' })
        successRef.current = setTimeout(() => setPhase('idle'), 2200)
      }
    } catch (err) {
      setPhase('error')
      const msg = err.message ?? 'Unknown error'
      setToast({ message: `Refresh failed: ${msg}`, variant: 'error' })
      successRef.current = setTimeout(() => setPhase('idle'), 2200)
    }
  }, [phase, onRefreshComplete])

  const PHASE_CONFIG = {
    idle:       { label: 'Refresh',      color: '#00d4ff', bgAlpha: 0.07, border: 'rgba(0,212,255,0.4)',  spinning: false },
    refreshing: { label: 'Refreshing…',  color: '#00d4ff', bgAlpha: 0.12, border: 'rgba(0,212,255,0.6)',  spinning: true  },
    success:    { label: 'Refreshed ✓',  color: '#00ff9d', bgAlpha: 0.14, border: 'rgba(0,255,157,0.6)',  spinning: false },
    error:      { label: 'Failed',       color: '#ff4466', bgAlpha: 0.12, border: 'rgba(255,68,102,0.5)', spinning: false },
  }

  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.idle
  const isActive = phase === 'refreshing'
  const isDisabled = phase !== 'idle' && phase !== 'error'

  return (
    <>
      <button
        id="btn-refresh"
        aria-label="Refresh telemetry data and recalculate conjunctions"
        aria-busy={isActive}
        disabled={isDisabled}
        title="Refresh telemetry data and recalculate conjunctions"
        onClick={handleRefresh}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 44,
          height: 44,
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.1rem',
          background: `rgba(${
            phase === 'success' ? '0,255,157' :
            phase === 'error'   ? '255,68,102' :
            '0,212,255'
          }, ${hovered && !isDisabled ? cfg.bgAlpha + 0.05 : cfg.bgAlpha})`,
          border: `1px solid ${cfg.border}`,
          color: cfg.color,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 200ms ease',
          boxShadow: phase === 'success'
            ? '0 0 16px rgba(0,255,157,0.35)'
            : phase === 'refreshing'
            ? '0 0 12px rgba(0,212,255,0.25)'
            : hovered && !isDisabled
            ? '0 0 12px rgba(0,212,255,0.2)'
            : 'none',
          opacity: isDisabled && !isActive ? 0.7 : 1,
          animation: phase === 'success' ? 'refresh-success-pulse 0.6s ease' : 'none',
        }}
      >
        <RefreshIcon spinning={isActive} />
        <span
          style={{
            fontSize: '0.42rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.85,
            lineHeight: 1,
            marginTop: 2,
            whiteSpace: 'nowrap',
          }}
        >
          {cfg.label}
        </span>
      </button>

      {toast && (
        <RefreshToast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  )
}

RefreshButton.propTypes = {
  onRefreshComplete: PropTypes.func,
}

RefreshButton.defaultProps = {
  onRefreshComplete: null,
}

export default RefreshButton
