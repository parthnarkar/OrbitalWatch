/**
 * @fileoverview AppContext — global UI state for OrbitalWatch.
 * Provides selected satellite, filter toggles, and active alert state.
 */

import { createContext, useContext, useState, useMemo } from 'react'

// ── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext(/** @type {AppContextValue | undefined} */ (undefined))

// ── JSDoc Types ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AppContextValue
 * @property {import('../types/satellite.js').Satellite | null} selectedSatellite
 * @property {(satellite: import('../types/satellite.js').Satellite | null) => void} setSelectedSatellite
 * @property {boolean} showDebrisOnly
 * @property {(value: boolean) => void} setShowDebrisOnly
 * @property {import('../types/satellite.js').Alert | null} activeAlert
 * @property {(alert: import('../types/satellite.js').Alert | null) => void} setActiveAlert
 */

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * AppProvider wraps the application and provides global UI state.
 *
 * @param {{ children: import('react').ReactNode }} props
 * @returns {JSX.Element}
 */
export function AppProvider({ children }) {
  const [selectedSatellite, setSelectedSatellite] = useState(null)
  const [showDebrisOnly, setShowDebrisOnly] = useState(false)
  const [activeAlert, setActiveAlert] = useState(null)

  // Memoize the context value to prevent unnecessary re-renders in consumers
  const value = useMemo(
    () => ({
      selectedSatellite,
      setSelectedSatellite,
      showDebrisOnly,
      setShowDebrisOnly,
      activeAlert,
      setActiveAlert,
    }),
    [selectedSatellite, showDebrisOnly, activeAlert]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Consumes the AppContext. Must be used inside an AppProvider.
 *
 * @returns {AppContextValue}
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
