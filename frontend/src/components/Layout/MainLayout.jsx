/**
 * @fileoverview MainLayout — root layout shell for OrbitalWatch.
 * F5 update: wires DemoMode toggle to Header, adds MobileSheet.
 */

import PropTypes from 'prop-types'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import MobileSheet from './MobileSheet.jsx'
import { useAppContext } from '../../context/AppContext.jsx'

/**
 * @param {Object} props
 * @param {import('react').ReactNode | Function} props.children - Render prop receives { activeView, activeNav }
 * @param {Function} [props.onNavChange] - Notified when active nav changes
 * @param {boolean}  [props.demoEnabled]
 * @param {Function} [props.onToggleDemo]
 * @returns {JSX.Element}
 */
function MainLayout({ children, onNavChange, demoEnabled, onToggleDemo }) {
  const { activeNav, setActiveNav, activeView, connected, alerts } = useAppContext()

  const handleNavChange = (id) => {
    setActiveNav(id)
    onNavChange?.(id)
  }

  return (
    <div
      id="main-layout"
      style={{ display: 'flex', minHeight: '100vh', background: 'var(--space-bg)' }}
    >
      {/* ── Fixed Sidebar (hidden on mobile via CSS) ──────────────────────────── */}
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
        <Header
          connected={connected}
          demoEnabled={demoEnabled}
          onToggleDemo={onToggleDemo}
        />

        <main id="main-content" role="main" style={{ flex: 1 }}>
          {typeof children === 'function' ? children({ activeView, activeNav }) : children}
        </main>
      </div>

      {/* ── Mobile Bottom Sheet (visible only on < 768px via CSS) ─────────────── */}
      <MobileSheet
        alertCount={alerts?.length ?? 0}
      />
    </div>
  )
}

MainLayout.propTypes = {
  children:      PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  onNavChange:   PropTypes.func,
  demoEnabled:   PropTypes.bool,
  onToggleDemo:  PropTypes.func,
}

MainLayout.defaultProps = {
  onNavChange:   null,
  demoEnabled:   false,
  onToggleDemo:  null,
}

export default MainLayout
