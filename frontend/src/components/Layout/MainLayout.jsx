/**
 * @fileoverview MainLayout — root layout shell for OrbitalWatch.
 * Composes the fixed Sidebar with the scrollable main content area.
 */

import { useState } from 'react'
import PropTypes from 'prop-types'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import useWebSocket from '../../hooks/useWebSocket.js'

/**
 * @param {Object} props
 * @param {import('react').ReactNode} props.children
 * @param {Function} [props.onResetCamera] Called when the Reset Camera button is pressed
 * @returns {JSX.Element}
 */
function MainLayout({ children, onResetCamera }) {
  const [activeNav, setActiveNav] = useState('dashboard')
  const { connected } = useWebSocket()

  return (
    <div
      id="main-layout"
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--space-bg)',
      }}
    >
      {/* ── Fixed Sidebar ────────────────────────────────────────────────────── */}
      <Sidebar activeNav={activeNav} onNavChange={setActiveNav} />

      {/* ── Main Area (offset by sidebar width) ──────────────────────────────── */}
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
        {/* Sticky header */}
        <Header connected={connected} onResetCamera={onResetCamera} />

        {/* Page content — no padding for the globe so it fills the viewport */}
        <main
          id="main-content"
          role="main"
          style={{
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

MainLayout.propTypes = {
  children: PropTypes.node.isRequired,
  onResetCamera: PropTypes.func,
}

MainLayout.defaultProps = {
  onResetCamera: null,
}

export default MainLayout
