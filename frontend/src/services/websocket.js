/**
 * @fileoverview WebSocket service for OrbitalWatch real-time data.
 * Wraps socket.io-client to provide a clean, singleton-friendly interface
 * for subscribing to live satellite position updates and alerts.
 */

import { io } from 'socket.io-client'

// ── WebSocketService Class ────────────────────────────────────────────────────

/**
 * Manages a socket.io connection to the OrbitalWatch backend.
 *
 * @example
 * const ws = new WebSocketService()
 * ws.connect()
 * ws.on('satellite_positions', (positions) => { ... })
 * // Later:
 * ws.disconnect()
 */
class WebSocketService {
  /**
   * @param {string} [url] - WebSocket server URL
   */
  constructor(url = import.meta.env.VITE_WS_URL || 'http://localhost:8000') {
    /** @type {string} */
    this.url = url

    /** @type {import('socket.io-client').Socket | null} */
    this.socket = null

    /** @type {boolean} */
    this._connected = false
  }

  /**
   * Establishes the socket.io connection and registers core lifecycle listeners.
   * Safe to call multiple times — will no-op if already connected.
   *
   * @returns {void}
   */
  connect() {
    if (this.socket?.connected) {
      console.log('[OrbitalWatch WS] Already connected, skipping reconnect')
      return
    }

    console.log(`[OrbitalWatch WS] Connecting to ${this.url} …`)

    this.socket = io(this.url, {
      transports: ['polling', 'websocket'], // polling first: more reliable on cold-start
      upgrade: true,                        // still upgrades to WS once connected
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      timeout: 20_000,
    })

    // ── Lifecycle events ─────────────────────────────────────────────────────

    this.socket.on('connect', () => {
      this._connected = true
      console.log(`[OrbitalWatch WS] ✅ Connected — socket id: ${this.socket.id}`)
    })

    this.socket.on('disconnect', (reason) => {
      this._connected = false
      console.warn(`[OrbitalWatch WS] ⚠️  Disconnected — reason: ${reason}`)
    })

    this.socket.on('connect_error', (error) => {
      this._connected = false
      console.error('[OrbitalWatch WS] ❌ Connection error:', error.message)
    })

    this.socket.on('reconnect', (attempt) => {
      console.log(`[OrbitalWatch WS] 🔄 Reconnected after ${attempt} attempt(s)`)
    })

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`[OrbitalWatch WS] 🔄 Reconnection attempt ${attempt}…`)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('[OrbitalWatch WS] ❌ All reconnection attempts failed')
    })
  }

  /**
   * Disconnects the socket and cleans up the instance.
   *
   * @returns {void}
   */
  disconnect() {
    if (this.socket) {
      console.log('[OrbitalWatch WS] Disconnecting…')
      this.socket.disconnect()
      this.socket = null
      this._connected = false
    }
  }

  /**
   * Registers an event listener on the socket.
   *
   * @param {string} event - The socket event name to listen for
   * @param {Function} callback - The handler function called with the event payload
   * @returns {void}
   */
  on(event, callback) {
    if (!this.socket) {
      console.warn(`[OrbitalWatch WS] Cannot register listener for '${event}' — not connected`)
      return
    }
    this.socket.on(event, callback)
  }

  /**
   * Removes an event listener from the socket.
   *
   * @param {string} event - The socket event name
   * @param {Function} [callback] - The specific handler to remove (removes all if omitted)
   * @returns {void}
   */
  off(event, callback) {
    if (!this.socket) return
    if (callback) {
      this.socket.off(event, callback)
    } else {
      this.socket.off(event)
    }
  }

  /**
   * Returns true if the socket is currently connected.
   *
   * @returns {boolean}
   */
  isConnected() {
    return this._connected && !!this.socket?.connected
  }
}

export default WebSocketService
