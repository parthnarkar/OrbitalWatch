/**
 * @fileoverview MainLayout — root layout shell for OrbitalWatch.
 * F3 update: exposes activeView state, passes alertCount + connected to Sidebar.
 */

import { useState } from 'react'
import PropTypes from 'prop-types'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import useWebSocket from '../../hooks/useWebSocket.js'

/**
 * @param {Object} props
 * @param {import('react').ReactNode} props.children - Render prop or node; receives { activeView }
 * @param {Function} [props.onResetCamera]
 * @param {Function} [props.onNavChange] - Notified when active nav changes
 * @returns {JSX.Element}
 */
function MainLayout({ children, onResetCamera, onNavChange }) {
  const [activeNav, setActiveNav] = useState('dashboard')
  const { connected, alerts } = useWebSocket()

  const handleNavChange = (id) => {
    setActiveNav(id)
    onNavChange?.(id)
  }

  // Map nav id → view name for consumers
  const VIEW_MAP = {
    dashboard: 'globe',
    satellites: 'globe',
    search: 'globe',
    alerts: 'alerts',
  }
  const activeView = VIEW_MAP[activeNav] ?? 'globe'

  return (
    <div
      id="main-layout"
      style={{ display: 'flex', minHeight: '100vh', background: 'var(--space-bg)' }}
    >
      {/* ── Fixed Sidebar ──────────────────────────────────────────────────────── */}
      <Sidebar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        alertCount={alerts?.length ?? 0}
        connected={connected}
      />

      {/* ── Main Area ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          minWidth: 0,
        }}
      >
        <Header connected={connected} onResetCamera={onResetCamera} />

        <main id="main-content" role="main" style={{ flex: 1, overflow: 'hidden' }}>
          {typeof children === 'function' ? children({ activeView, activeNav }) : children}
        </main>
      </div>
    </div>
  )
}

MainLayout.propTypes = {
  children:       PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  onResetCamera:  PropTypes.func,
  onNavChange:    PropTypes.func,
}

MainLayout.defaultProps = {
  onResetCamera: null,
  onNavChange:   null,
}

export default MainLayout
