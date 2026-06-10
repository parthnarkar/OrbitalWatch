/**
 * @fileoverview helpers.js — Pure utility functions for OrbitalWatch.
 * All functions are side-effect-free and safe to memoize.
 */

// ── Time ──────────────────────────────────────────────────────────────────────

/**
 * Format a date as a human-readable relative time string.
 *
 * @param {Date | string | number | null | undefined} date
 * @returns {string} e.g. "Just now", "5m ago", "2h ago", "3d ago"
 */
export function formatRelativeTime(date) {
  if (!date) return '—'
  const diff = Date.now() - new Date(date).getTime()
  if (isNaN(diff)) return '—'
  const abs = Math.abs(diff)
  if (abs < 30_000)           return 'Just now'
  if (abs < 3_600_000)        return `${Math.floor(abs / 60_000)}m ago`
  if (abs < 86_400_000)       return `${Math.floor(abs / 3_600_000)}h ago`
  return `${Math.floor(abs / 86_400_000)}d ago`
}

/**
 * Format a countdown in milliseconds as "T-HH:MM:SS".
 * Returns the absolute datetime string for events > 24 hours away.
 *
 * @param {Date | string | number | null | undefined} futureDate
 * @returns {string}
 */
export function formatCountdown(futureDate) {
  if (!futureDate) return '—'
  const diff = new Date(futureDate).getTime() - Date.now()
  if (isNaN(diff) || diff < 0) return new Date(futureDate).toLocaleString()
  if (diff > 86_400_000) return new Date(futureDate).toLocaleString()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  return `T-${pad(h)}:${pad(m)}:${pad(s)}`
}

/** @param {number} n */
function pad(n) {
  return String(n).padStart(2, '0')
}

// ── Numbers ───────────────────────────────────────────────────────────────────

/**
 * Format a distance in kilometres.
 *
 * @param {number | null | undefined} km
 * @param {number} [decimals=2]
 * @returns {string} e.g. "0.45 km", "12.30 km"
 */
export function formatDistance(km, decimals = 2) {
  if (km == null || isNaN(Number(km))) return '—'
  return `${Number(km).toFixed(decimals)} km`
}

/**
 * Format a velocity in km/s.
 *
 * @param {number | null | undefined} kms
 * @param {number} [decimals=2]
 * @returns {string} e.g. "7.66 km/s"
 */
export function formatVelocity(kms, decimals = 2) {
  if (kms == null || isNaN(Number(kms))) return '—'
  return `${Number(kms).toFixed(decimals)} km/s`
}

/**
 * Format a probability (0–1) as a percentage string.
 *
 * @param {number | null | undefined} prob
 * @param {number} [decimals=3]
 * @returns {string} e.g. "0.012%"
 */
export function formatProbability(prob, decimals = 3) {
  if (prob == null || isNaN(Number(prob))) return '—'
  return `${(Number(prob) * 100).toFixed(decimals)}%`
}

// ── Colours ───────────────────────────────────────────────────────────────────

/**
 * Returns the hex colour associated with a conjunction risk level.
 *
 * @param {'LOW' | 'MEDIUM' | 'HIGH' | string | null | undefined} level
 * @returns {string} hex colour
 */
export function getRiskColor(level) {
  switch ((level ?? '').toUpperCase()) {
    case 'HIGH':   return '#ff4d4d'
    case 'MEDIUM': return '#ff9d00'
    case 'LOW':    return '#00ff9d'
    default:       return '#8888aa'
  }
}

/**
 * Returns the hex colour associated with a satellite object type.
 *
 * @param {'payload' | 'debris' | 'rocket body' | 'rocket_body' | string | null | undefined} type
 * @returns {string} hex colour
 */
export function getTypeColor(type) {
  const t = (type ?? '').toLowerCase().replace('_', ' ')
  switch (t) {
    case 'payload':      return '#00ff9d'
    case 'debris':       return '#ff4466'
    case 'rocket body':  return '#ffbb33'
    default:             return '#8888aa'
  }
}
