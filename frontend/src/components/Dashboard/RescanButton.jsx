/**
 * @fileoverview RescanButton — Fetches fresh orbital data from CelesTrak.
 *
 * States:
 *  idle      → cyan outline, label "Rescan"
 *  pinging   → subtle pulse, label "Connecting…"
 *  scanning  → spinning icon, label "Scanning…"
 *  success   → green pulse, label "Updated" (2 s) → returns to idle
 *  error     → red pulse, label "Failed — Retry?"
 *  cooldown  → muted, label "Wait Xs…" (countdown)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import { pingCelesTrak, triggerRescan } from '../../services/api.js'

// ── Spinning radar icon ───────────────────────────────────────────────────────

function RadarIcon({ spinning }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        animation: spinning ? 'rescan-spin 0.9s linear infinite' : 'none',
      }}
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  )
}

RadarIcon.propTypes = { spinning: PropTypes.bool }
RadarIcon.defaultProps = { spinning: false }

// ── Toast notification (local, self-dismissing) ───────────────────────────────

function RescanToast({ message, variant, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const colors = {
    success: { bg: 'rgba(0,255,157,0.12)', border: 'rgba(0,255,157,0.4)', text: '#00ff9d' },
    error:   { bg: 'rgba(255,68,102,0.12)', border: 'rgba(255,68,102,0.4)', text: '#ff4466' },
    info:    { bg: 'rgba(0,212,255,0.12)',  border: 'rgba(0,212,255,0.4)',  text: '#00d4ff' },
    warning: { bg: 'rgba(255,187,51,0.12)', border: 'rgba(255,187,51,0.4)', text: '#ffbb33' },
  }
  const c = colors[variant] ?? colors.info

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 80,
        right: 24,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.875rem 1.125rem',
        background: 'rgba(10,10,18,0.97)',
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.text}`,
        borderRadius: 12,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        maxWidth: 340,
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
    </div>
  )
}

RescanToast.propTypes = {
  message:   PropTypes.string.isRequired,
  variant:   PropTypes.oneOf(['success', 'error', 'info', 'warning']).isRequired,
  onDismiss: PropTypes.func.isRequired,
}

// ── Main RescanButton component ───────────────────────────────────────────────

/**
 * @param {{
 *   onRescanComplete: (result: object) => void,
 * }} props
 */
function RescanButton({ onRescanComplete }) {
  const [phase, setPhase] = useState('idle')   // idle | pinging | scanning | success | error | cooldown
  const [cooldownSec, setCooldownSec] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [toast, setToast] = useState(/** @type {{ message: string, variant: string }|null} */ (null))

  const cooldownRef = useRef(null)
  const successRef  = useRef(null)

  const clearTimers = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    if (successRef.current)  clearTimeout(successRef.current)
  }

  // Cooldown countdown ticker
  const startCooldown = useCallback((seconds) => {
    clearTimers()
    setCooldownSec(seconds)
    setPhase('cooldown')

    cooldownRef.current = setInterval(() => {
      setCooldownSec((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          setPhase('idle')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => clearTimers(), [])

  const handleRescan = useCallback(async () => {
    if (phase !== 'idle' && phase !== 'error') return

    // 1. Connectivity probe
    setPhase('pinging')
    let pingResult
    try {
      pingResult = await pingCelesTrak()
    } catch {
      pingResult = { reachable: false, latency_ms: 0, message: 'Network error' }
    }

    if (!pingResult.reachable) {
      setPhase('error')
      setToast({
        message: `API Offline — Using cached data. (${pingResult.message})`,
        variant: 'warning',
      })
      return
    }

    // 2. Full rescan
    setPhase('scanning')
    try {
      const result = await triggerRescan()

      if (!result.success && result.cooldown_remaining > 0) {
        startCooldown(result.cooldown_remaining)
        setToast({
          message: `Please wait ${result.cooldown_remaining}s before rescanning again.`,
          variant: 'info',
        })
        return
      }

      // Success
      setPhase('success')
      setToast({ message: result.message, variant: 'success' })

      console.log(
        `[Rescan] API ping: ${pingResult.latency_ms}ms | ` +
        `Fetched: ${result.fetched} objects | Valid: ${result.valid} | ` +
        `Rejected: ${result.rejected} | Inserted: ${result.inserted} | ` +
        `Updated: ${result.updated} | Total: ${result.total_in_catalog}`
      )

      // Notify parent to refresh satellite list + stats
      onRescanComplete?.({
        timestamp: result.timestamp,
        total: result.total_in_catalog,
        inserted: result.inserted,
        updated: result.updated,
      })

      // Return to idle after 2 s
      successRef.current = setTimeout(() => setPhase('idle'), 2200)

      // Start cooldown (non-blocking — timer runs in background after button resets)
      startCooldown(30)
    } catch (err) {
      setPhase('error')
      const msg = err?.response?.status === 429
        ? 'Rate limited by CelesTrak — try again in a minute.'
        : err?.response?.status === 503
        ? 'CelesTrak service unavailable (503).'
        : err?.code === 'ECONNABORTED'
        ? 'Request timed out — CelesTrak may be slow.'
        : `Rescan failed: ${err.message ?? 'Unknown error'}`
      setToast({ message: msg, variant: 'error' })
    }
  }, [phase, onRescanComplete, startCooldown])

  // ── Derived label & color ──────────────────────────────────────────────────
  const PHASE_CONFIG = {
    idle:     { label: 'Rescan',      color: '#00d4ff', bgAlpha: 0.07, border: 'rgba(0,212,255,0.4)',  spinning: false },
    pinging:  { label: 'Connecting…', color: '#00d4ff', bgAlpha: 0.10, border: 'rgba(0,212,255,0.5)',  spinning: true  },
    scanning: { label: 'Scanning…',   color: '#00d4ff', bgAlpha: 0.12, border: 'rgba(0,212,255,0.6)',  spinning: true  },
    success:  { label: 'Updated ✓',   color: '#00ff9d', bgAlpha: 0.14, border: 'rgba(0,255,157,0.6)',  spinning: false },
    error:    { label: 'Failed — Retry?', color: '#ff4466', bgAlpha: 0.12, border: 'rgba(255,68,102,0.5)', spinning: false },
    cooldown: { label: `Wait ${cooldownSec}s…`, color: '#8888aa', bgAlpha: 0.04, border: 'rgba(136,136,170,0.2)', spinning: false },
  }
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.idle

  const isActive  = phase === 'pinging' || phase === 'scanning'
  const isDisabled = phase === 'cooldown' || isActive

  return (
    <>
      <button
        id="btn-rescan"
        aria-label="Fetch fresh orbital data from CelesTrak (max 500 objects)"
        aria-busy={isActive}
        disabled={isDisabled}
        title={
          phase === 'cooldown'
            ? `Rate limited — wait ${cooldownSec}s`
            : 'Fetch fresh orbital data from CelesTrak (max 500 objects)'
        }
        onClick={handleRescan}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
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
            : phase === 'scanning'
            ? '0 0 12px rgba(0,212,255,0.25)'
            : hovered && !isDisabled
            ? '0 0 12px rgba(0,212,255,0.2)'
            : 'none',
          opacity: phase === 'cooldown' ? 0.5 : 1,
          animation: phase === 'success' ? 'rescan-success-pulse 0.6s ease' : 'none',
        }}
      >
        <RadarIcon spinning={isActive} />
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

      {/* Self-dismissing toast */}
      {toast && (
        <RescanToast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  )
}

RescanButton.propTypes = {
  onRescanComplete: PropTypes.func,
}

RescanButton.defaultProps = {
  onRescanComplete: null,
}

export default RescanButton
