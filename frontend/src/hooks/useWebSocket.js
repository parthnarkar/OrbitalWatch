/**
 * @fileoverview useWebSocket hook — manages real-time satellite position and alert streams.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import WebSocketService from '../services/websocket.js'

/**
 * Connects to the OrbitalWatch WebSocket server and subscribes to live data streams.
 *
 * @param {boolean} [isGlobeView=true] - Whether the user is currently on the globe view
 * @returns {{
 *   positions: import('../types/satellite.js').SatellitePosition[],
 *   alerts: import('../types/satellite.js').Alert[],
 *   connected: boolean,
 *   pendingAlerts: import('../types/satellite.js').Alert[],
 *   clearPendingAlerts: (id?: string | number) => void,
 * }}
 */
function useWebSocket(isGlobeView = true) {
  const [positions, setPositions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)
  const [pendingAlerts, setPendingAlerts] = useState([])

  // Use a ref to avoid re-creating the service on every render
  const wsRef = useRef(/** @type {WebSocketService | null} */ (null))

  // Track isGlobeView via a ref so our listeners can access the fresh value
  // without having to tear down and rebuild the WebSocket connection
  const isGlobeViewRef = useRef(isGlobeView)
  useEffect(() => {
    isGlobeViewRef.current = isGlobeView
  }, [isGlobeView])

  const lastMessageTime = useRef(Date.now())

  // Clear specific or all pending alerts
  const clearPendingAlerts = useCallback((id) => {
    if (id !== undefined) {
      setPendingAlerts((prev) =>
        prev.filter((a) => {
          const alertId = a.id ?? a.conjunction_id
          return String(alertId) !== String(id)
        })
      )
    } else {
      setPendingAlerts([])
    }
  }, [])

  useEffect(() => {
    const ws = new WebSocketService()
    wsRef.current = ws

    ws.connect()
    lastMessageTime.current = Date.now()

    // ── Subscribe to connection state ────────────────────────────────────────
    ws.on('connect', () => {
      setConnected(true)
      lastMessageTime.current = Date.now()
    })

    ws.on('disconnect', () => {
      setConnected(false)
    })

    ws.on('connect_error', () => {
      setConnected(false)
    })

    // ── Subscribe to satellite position updates ───────────────────────────────
    /**
     * @param {import('../types/satellite.js').SatellitePosition[]} newPositions
     */
    const handlePositions = (newPositions) => {
      if (!Array.isArray(newPositions)) return
      lastMessageTime.current = Date.now()
      setPositions([...newPositions])
      setConnected(true)
    }

    ws.on('satellite_positions', handlePositions)

    // ── Subscribe to new alerts ──────────────────────────────────────────────
    /**
     * @param {import('../types/satellite.js').Alert} alert
     */
    const handleAlert = (alert) => {
      if (!alert) return
      lastMessageTime.current = Date.now()
      setConnected(true)

      // Prepend new alert; keep at most 100 in memory
      setAlerts((prev) => [alert, ...prev].slice(0, 100))

      // Queue alert if the user is on the globe view
      if (isGlobeViewRef.current) {
        setPendingAlerts((prev) => [...prev, alert])
      }
    }

    ws.on('new_alert', handleAlert)

    // ── Heartbeat Check ──────────────────────────────────────────────────────
    const checkHeartbeat = () => {
      const elapsed = Date.now() - lastMessageTime.current
      if (elapsed > 70000) {
        console.warn('[useWebSocket] Heartbeat timeout: no messages for 70 seconds. Reconnecting...')
        setConnected(false)
        ws.disconnect()
        ws.connect()
        // Reset timer to allow 70s for new connection
        lastMessageTime.current = Date.now()
      }
    }
    const heartbeatInterval = setInterval(checkHeartbeat, 5000)

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    return () => {
      clearInterval(heartbeatInterval)
      ws.off('connect')
      ws.off('disconnect')
      ws.off('connect_error')
      ws.off('satellite_positions', handlePositions)
      ws.off('new_alert', handleAlert)
      ws.disconnect()
      wsRef.current = null
    }
  }, []) // run once on mount

  return {
    positions,
    alerts,
    connected,
    pendingAlerts,
    clearPendingAlerts,
  }
}

export default useWebSocket
