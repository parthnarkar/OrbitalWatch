/**
 * @fileoverview API service layer for OrbitalWatch.
 * Wraps all REST API calls to the backend with error handling and response normalisation.
 */

import axios from 'axios'

// ── Axios Instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ── Backend Wake-up Utilities ─────────────────────────────────────────────────

const WS_BASE = import.meta.env.VITE_WS_URL || 'http://localhost:8000'

/**
 * Hits /ping — a zero-DB endpoint — to check if the backend is alive.
 * Useful for waking up a Render free-tier instance before making real requests.
 *
 * @returns {Promise<boolean>}
 */
export async function pingBackend() {
  try {
    const url = `${WS_BASE === '/' ? '' : WS_BASE}/ping`
    await axios.get(url, { timeout: 6_000 })
    return true
  } catch {
    return false
  }
}

/**
 * Polls /ping until the backend responds or the attempt limit is reached.
 * Resolves to true when the backend is ready, false on timeout.
 *
 * @param {{ maxAttempts?: number, intervalMs?: number, onAttempt?: (n: number) => void }} [opts]
 * @returns {Promise<boolean>}
 */
export async function wakeUpBackend({ maxAttempts = 15, intervalMs = 4_000, onAttempt } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    if (onAttempt) onAttempt(i + 1)
    const ok = await pingBackend()
    if (ok) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

/**
 * Wraps any async fetch with simple retry + exponential backoff.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, baseDelayMs?: number }} [opts]
 * @returns {Promise<T>}
 */
async function withRetry(fn, { attempts = 3, baseDelayMs = 1_500 } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)))
      }
    }
  }
  throw lastErr
}



// ── Request Interceptor ───────────────────────────────────────────────────────

api.interceptors.request.use(
  (config) => {
    // Auth token placeholder — remove the comment and add token logic when auth is implemented
    // const token = localStorage.getItem('ow_token')
    // if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => {
    console.error('[OrbitalWatch API] Request error:', error)
    return Promise.reject(error)
  }
)

// ── Response Interceptor ──────────────────────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with an error status
      const { status, data } = error.response
      const message = data?.detail || data?.message || `HTTP ${status} error`
      console.error(`[OrbitalWatch API] ${status} —`, message)
      const apiError = new Error(message)
      apiError.status = status
      apiError.data = data
      return Promise.reject(apiError)
    } else if (error.request) {
      // Request was made but no response received
      console.error('[OrbitalWatch API] No response received:', error.request)
      return Promise.reject(new Error('Unable to reach the server. Please check your connection.'))
    } else {
      // Request setup error
      console.error('[OrbitalWatch API] Request setup error:', error.message)
      return Promise.reject(new Error(error.message))
    }
  }
)

// ── API Functions ─────────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of all tracked satellites.
 *
 * @param {{ page?: number, limit?: number, object_type?: string } | undefined} params
 * @returns {Promise<import('../types/satellite.js').Satellite[]>}
 */
export async function fetchSatellites(params = {}) {
  return withRetry(() => api.get('/satellites', { params }).then((r) => r.data))
}

/**
 * Fetch a single satellite by its NORAD catalog ID.
 *
 * @param {string} norad_id - The NORAD catalog number
 * @returns {Promise<import('../types/satellite.js').Satellite>}
 */
export async function fetchSatellite(norad_id) {
  const response = await api.get(`/satellites/${encodeURIComponent(norad_id)}`)
  return response.data
}

/**
 * Search for satellites by name or NORAD ID.
 *
 * @param {string} query - Search query string
 * @returns {Promise<import('../types/satellite.js').Satellite[]>}
 */
export async function searchSatellites(query) {
  if (!query || !query.trim()) return []
  const response = await api.get('/satellites/search', {
    params: { q: query.trim() },
  })
  return response.data
}

/**
 * Fetch conjunction events, optionally filtered by risk level.
 *
 * @param {'LOW'|'MEDIUM'|'HIGH'|undefined} risk_level - Filter by risk level
 * @returns {Promise<import('../types/satellite.js').Conjunction[]>}
 */
export async function fetchConjunctions(risk_level) {
  const params = risk_level ? { risk_level } : {}
  return withRetry(() => api.get('/conjunctions', { params }).then((r) => r.data))
}

/**
 * Fetch high-level dashboard statistics.
 *
 * @returns {Promise<import('../types/satellite.js').AppStats>}
 */
export async function fetchStats() {
  return withRetry(() => api.get('/stats').then((r) => r.data))
}

/**
 * Trigger a telemetry refresh and background conjunction calculation.
 *
 * @returns {Promise<{
 *   success: boolean,
 *   message: string,
 *   timestamp: string,
 * }>}
 */
export async function triggerRefresh() {
  const response = await api.post('/refresh')
  return response.data
}

export default api
