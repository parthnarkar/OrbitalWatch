/**
 * @fileoverview MainLayout — root layout shell for OrbitalWatch.
 * Redesigned: sidebar removed, globe takes full width.
 */

import PropTypes from 'prop-types'
import Header from './Header.jsx'
import MobileSheet from './MobileSheet.jsx'
import { useAppContext } from '../../context/AppContext.jsx'

/**
 * @param {Object} props
 * @param {import('react').ReactNode | Function} props.children
 * @param {Function} [props.onNavChange]
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
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#000000' }}
    >
      {/* ── Sticky Header ─────────────────────────────────────────────────────── */}
      <Header
        connected={connected}
        demoEnabled={demoEnabled}
        onToggleDemo={onToggleDemo}
        activeNav={activeNav}
        onNavChange={handleNavChange}
        alertCount={alerts?.length ?? 0}
      />

      {/* ── Full-width Main Area ──────────────────────────────────────────────── */}
      <main id="main-content" role="main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {typeof children === 'function' ? children({ activeView, activeNav }) : children}
      </main>

      {/* ── Mobile Bottom Sheet ───────────────────────────────────────────────── */}
      <MobileSheet alertCount={alerts?.length ?? 0} />
    </div>
  )
}

MainLayout.propTypes = {
  children:     PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  onNavChange:  PropTypes.func,
  demoEnabled:  PropTypes.bool,
  onToggleDemo: PropTypes.func,
}

MainLayout.defaultProps = {
  onNavChange:  null,
  demoEnabled:  false,
  onToggleDemo: null,
}

export default MainLayout
