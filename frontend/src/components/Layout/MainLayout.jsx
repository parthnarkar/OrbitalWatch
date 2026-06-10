/**
 * @fileoverview MainLayout — root layout shell for OrbitalWatch.
 * Composes the fixed Sidebar with the scrollable main content area.
 */

import { useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import useWebSocket from '../../hooks/useWebSocket.js'

/**
 * @param {{ children: import('react').ReactNode }} props
 * @returns {JSX.Element}
 */
function MainLayout({ children }) {
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
        <Header connected={connected} />

        {/* Scrollable page content */}
        <main
          id="main-content"
          role="main"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export default MainLayout
