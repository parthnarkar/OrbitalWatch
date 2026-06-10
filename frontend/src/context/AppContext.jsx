/**
 * @fileoverview AppContext — global state and unified WebSocket context for OrbitalWatch.
 * Provides selected satellite, active alerts, navigation state, filters, and filtered satellites.
 */

import { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import useWebSocket from '../hooks/useWebSocket.js'

// ── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext(undefined)

// ── Default Filters ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  types: ['payload', 'debris', 'rocket body', 'unknown'],
  minAltitude: 0,
  maxAltitude: 40000,
}

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * AppProvider wraps the application and provides global UI and streaming state.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export function AppProvider({ children }) {
  // Navigation State
  const [activeNav, setActiveNav] = useState('dashboard')

  // Map nav id → view name
  const activeView = useMemo(() => {
    const VIEW_MAP = {
      dashboard: 'globe',
      satellites: 'globe',
      search: 'globe',
      alerts: 'alerts',
    }
    return VIEW_MAP[activeNav] ?? 'globe'
  }, [activeNav])

  // WebSocket Connection
  // Pass whether we are on the globe view to queue incoming alerts accordingly
  const {
    positions,
    alerts,
    connected,
    pendingAlerts,
    clearPendingAlerts,
  } = useWebSocket(activeView === 'globe')

  // UI States
  const [selectedSatellite, setSelectedSatellite] = useState(null)
  const [showDebrisOnly, setShowDebrisOnly] = useState(false)
  const [activeAlert, setActiveAlert] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    if (positions.length > 0) {
      setLastUpdate(new Date())
    }
  }, [positions])

  // Settings
  const [autoSwitchOnHighRisk, setAutoSwitchOnHighRisk] = useState(true)

  // Filters State
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  // Compute filtered satellites
  const filteredSatellites = useMemo(() => {
    return positions.filter((sat) => {
      // 1. Type filtering
      const type = (sat.type || sat.object_type || 'unknown').toLowerCase()
      const normalizedType = type === 'rocket_body' ? 'rocket body' : type

      // Respect the sidebar "Debris Only" toggle if active
      if (showDebrisOnly && normalizedType !== 'debris') {
        return false
      }

      const isTypeMatch = filters.types.map((t) => t.toLowerCase()).includes(normalizedType)
      if (!isTypeMatch) return false

      // 2. Altitude filtering
      const alt = sat.altitude_km ?? sat.alt ?? sat.altitude ?? 0
      const minAlt = filters.minAltitude === '' ? 0 : Number(filters.minAltitude)
      const maxAlt = filters.maxAltitude === '' ? Infinity : Number(filters.maxAltitude)

      return alt >= minAlt && alt <= maxAlt
    })
  }, [positions, filters, showDebrisOnly])

  // Auto-switch to Alerts view when a HIGH risk alert arrives and user is on globe view
  const lastHandledAlertId = useRef(null)
  const latestAlert = alerts[0]

  useEffect(() => {
    if (latestAlert && autoSwitchOnHighRisk && activeView === 'globe') {
      const alertId = latestAlert.id ?? latestAlert.conjunction_id
      if (alertId !== lastHandledAlertId.current) {
        lastHandledAlertId.current = alertId
        if (latestAlert.risk_level === 'HIGH') {
          setActiveNav('alerts')
          setActiveAlert(latestAlert)
        }
      }
    }
  }, [latestAlert, autoSwitchOnHighRisk, activeView])

  // Memoize the context value to prevent unnecessary re-renders in consumers
  const value = useMemo(
    () => ({
      // Navigation
      activeNav,
      setActiveNav,
      activeView,

      // WebSocket Data
      positions,
      alerts,
      connected,
      pendingAlerts,
      clearPendingAlerts,
      lastUpdate,

      // UI States
      selectedSatellite,
      setSelectedSatellite,
      showDebrisOnly,
      setShowDebrisOnly,
      activeAlert,
      setActiveAlert,

      // Settings
      autoSwitchOnHighRisk,
      setAutoSwitchOnHighRisk,

      // Filters
      filters,
      setFilters,
      filteredSatellites,
    }),
    [
      activeNav,
      activeView,
      positions,
      alerts,
      connected,
      pendingAlerts,
      clearPendingAlerts,
      lastUpdate,
      selectedSatellite,
      showDebrisOnly,
      activeAlert,
      autoSwitchOnHighRisk,
      filters,
      filteredSatellites,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Consumes the AppContext. Must be used inside an AppProvider.
 *
 * @returns {Object}
 * @throws {Error} If called outside of AppProvider
 */
export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}

export default AppContext
