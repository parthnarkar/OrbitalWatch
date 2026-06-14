/**
 * @fileoverview AppContext — global state and unified WebSocket context for OrbitalWatch.
 * Provides selected satellite, active alerts, navigation state, filters, and filtered satellites.
 */

import { createContext, useContext, useState, useMemo, useEffect } from 'react'
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
      alerts: 'alerts',
      simulator: 'simulator',
    }
    return VIEW_MAP[activeNav] ?? 'globe'
  }, [activeNav])

  // WebSocket Connection
  // Pass whether we are on the globe view to queue incoming alerts accordingly
  const {
    positions,
    alerts: liveAlerts,
    connected,
    pendingAlerts,
    clearPendingAlerts,
  } = useWebSocket(activeView === 'globe')

  const [conjunctions, setConjunctions] = useState([])

  // Merge live WebSocket alerts with static historical conjunctions
  const mergedConjunctions = useMemo(() => {
    const map = new Map()
    conjunctions.forEach((c) => {
      const id = c.id ?? c.conjunction_id
      if (id != null) map.set(String(id), c)
    })
    liveAlerts.forEach((a) => {
      const id = a.id ?? a.conjunction_id
      if (id != null) map.set(String(id), a)
    })
    return Array.from(map.values()).sort((a, b) => {
      const ta = new Date(a.approach_time ?? a.tca ?? 0).getTime()
      const tb = new Date(b.approach_time ?? b.tca ?? 0).getTime()
      return tb - ta
    })
  }, [conjunctions, liveAlerts])

  const [selectedSatellite, setSelectedSatellite] = useState(null)
  const [showDebrisOnly, setShowDebrisOnly] = useState(false)
  const [activeAlert, setActiveAlert] = useState(null)
  const [focusedConjunction, setFocusedConjunction] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Simulation States
  const [simOpen, setSimOpen] = useState(false)
  const [simParams, setSimParams] = useState({
    name: 'Phoenix-1',
    launchSite: 'Cape Canaveral',
    altitudeKm: 500,
    inclination: 28.5383,
    eccentricity: 0.0001,
    raan: '',
    payloadMass: 500,
    durationYears: 5,
    deorbitStrategy: 'Active'
  })
  const [simActive, setSimActive] = useState(false)
  const [simResult, setSimResult] = useState(null)
  const [simLaunched, setSimLaunched] = useState(false)

  // Sync simOpen with activeNav for unified navigation page logic
  useEffect(() => {
    if (activeNav === 'simulator') {
      setSimOpen(true)
    } else {
      setSimOpen(false)
      setSimLaunched(false)
      setSimResult(null)
      setSimActive(false)
    }
  }, [activeNav, setSimOpen, setSimLaunched, setSimResult, setSimActive])

  useEffect(() => {
    if (positions.length > 0) {
      setLastUpdate(new Date())
    }
  }, [positions])

  // Clear activeAlert when navigating away from alerts view to prevent spontaneous opening
  useEffect(() => {
    if (activeNav !== 'alerts') {
      setActiveAlert(null)
    }
  }, [activeNav])

  // Clear focusedConjunction when navigating away from dashboard
  useEffect(() => {
    if (activeNav !== 'dashboard') {
      setFocusedConjunction(null)
    }
  }, [activeNav])

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

  // Memoize the context value to prevent unnecessary re-renders in consumers
  const value = useMemo(
    () => ({
      // Navigation
      activeNav,
      setActiveNav,
      activeView,

      // WebSocket Data
      positions,
      liveAlerts,
      conjunctions,
      setConjunctions,
      alerts: mergedConjunctions,
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
      focusedConjunction,
      setFocusedConjunction,

      // Filters
      filters,
      setFilters,
      filteredSatellites,

      // Launch Simulator States
      simOpen,
      setSimOpen,
      simParams,
      setSimParams,
      simActive,
      setSimActive,
      simResult,
      setSimResult,
      simLaunched,
      setSimLaunched,
    }),
    [
      activeNav,
      activeView,
      positions,
      liveAlerts,
      conjunctions,
      mergedConjunctions,
      connected,
      pendingAlerts,
      clearPendingAlerts,
      lastUpdate,
      selectedSatellite,
      showDebrisOnly,
      activeAlert,
      focusedConjunction,
      filters,
      filteredSatellites,
      simOpen,
      simParams,
      simActive,
      simResult,
      simLaunched,
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
