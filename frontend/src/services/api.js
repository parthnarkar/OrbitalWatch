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

// ── Request Interceptor ───────────────────────────────────────────────────────

api.interceptors.request.use(
  (config) => {
    // Attach auth token from localStorage if present (future-proofing)
    const token = localStorage.getItem('ow_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
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
  const response = await api.get('/satellites', { params })
  return response.data
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
  const response = await api.get('/conjunctions', { params })
  return response.data
}

/**
 * Fetch high-level dashboard statistics.
 *
 * @returns {Promise<import('../types/satellite.js').AppStats>}
 */
export async function fetchStats() {
  const response = await api.get('/stats')
  return response.data
}

export default api
