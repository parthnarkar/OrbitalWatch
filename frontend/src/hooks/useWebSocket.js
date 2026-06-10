/**
 * @fileoverview useWebSocket hook — manages real-time satellite position and alert streams.
 */

import { useState, useEffect, useRef } from 'react'
import WebSocketService from '../services/websocket.js'

/**
 * Connects to the OrbitalWatch WebSocket server and subscribes to live data streams.
 *
 * @returns {{
 *   positions: import('../types/satellite.js').SatellitePosition[],
 *   alerts: import('../types/satellite.js').Alert[],
 *   connected: boolean,
 * }}
 */
function useWebSocket() {
  const [positions, setPositions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)

  // Use a ref to avoid re-creating the service on every render
  const wsRef = useRef(/** @type {WebSocketService | null} */ (null))

  useEffect(() => {
    const ws = new WebSocketService()
    wsRef.current = ws

    ws.connect()

    // ── Subscribe to connection state ────────────────────────────────────────
    ws.on('connect', () => {
      setConnected(true)
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
      // Replace the entire positions snapshot (server sends full batch)
      setPositions([...newPositions])
    }

    ws.on('satellite_positions', handlePositions)

    // ── Subscribe to new alerts ──────────────────────────────────────────────
    /**
     * @param {import('../types/satellite.js').Alert} alert
     */
    const handleAlert = (alert) => {
      if (!alert) return
      // Prepend new alert; keep at most 100 in memory
      setAlerts((prev) => [alert, ...prev].slice(0, 100))
    }

    ws.on('new_alert', handleAlert)

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    return () => {
      ws.off('connect')
      ws.off('disconnect')
      ws.off('connect_error')
      ws.off('satellite_positions', handlePositions)
      ws.off('new_alert', handleAlert)
      ws.disconnect()
      wsRef.current = null
    }
  }, []) // run once on mount

  return { positions, alerts, connected }
}

export default useWebSocket
