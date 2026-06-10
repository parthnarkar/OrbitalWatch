/**
 * @fileoverview useSatellites hook — fetches and manages the satellite list.
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchSatellites } from '../services/api.js'

/**
 * Fetches the full satellite catalogue from the API.
 *
 * @returns {{
 *   satellites: import('../types/satellite.js').Satellite[],
 *   loading: boolean,
 *   error: string | null,
 *   refetch: () => void,
 * }}
 */
function useSatellites() {
  const [satellites, setSatellites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(/** @type {string|null} */ (null))
  const [fetchTrigger, setFetchTrigger] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchSatellites()
        if (!cancelled) {
          setSatellites(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch satellites')
          setSatellites([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [fetchTrigger])

  /**
   * Triggers a fresh fetch, clearing any existing error.
   */
  const refetch = useCallback(() => {
    setFetchTrigger((n) => n + 1)
  }, [])

  return { satellites, loading, error, refetch }
}

export default useSatellites
