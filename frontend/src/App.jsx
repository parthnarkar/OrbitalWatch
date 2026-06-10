/**
 * @fileoverview App.jsx — Root application component for OrbitalWatch.
 */

import { AppProvider } from './context/AppContext.jsx'
import MainLayout from './components/Layout/MainLayout.jsx'
import './index.css'

// ── Placeholder Dashboard Content ─────────────────────────────────────────────

/**
 * Temporary placeholder shown until the 3D globe (Prompt F2) is integrated.
 *
 * @returns {JSX.Element}
 */
function DashboardPlaceholder() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - var(--header-height) - 3rem)',
        gap: '2rem',
        textAlign: 'center',
        animation: 'fadeIn 0.6s ease forwards',
      }}
    >
      {/* Animated orbital graphic */}
      <div
        style={{
          position: 'relative',
          width: 160,
          height: 160,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer ring */}
        <div
          style={{
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: '50%',
            border: '1px solid rgba(0,212,255,0.2)',
          }}
        />
        {/* Middle ring */}
        <div
          style={{
            position: 'absolute',
            width: 110,
            height: 110,
            borderRadius: '50%',
            border: '1px dashed rgba(0,255,157,0.2)',
            animation: 'orbit 8s linear infinite reverse',
          }}
        />
        {/* Inner ring */}
        <div
          style={{
            position: 'absolute',
            width: 70,
            height: 70,
            borderRadius: '50%',
            border: '1px solid rgba(0,212,255,0.3)',
            animation: 'orbit 5s linear infinite',
          }}
        />
        {/* Earth core */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #1a6bb5, #0a3060)',
            boxShadow: '0 0 30px rgba(0,100,200,0.4), inset 0 0 15px rgba(0,0,0,0.5)',
            zIndex: 1,
          }}
        />
        {/* Orbiting satellite dot */}
        <div
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--space-cyan)',
            boxShadow: 'var(--glow-cyan)',
            animation: 'orbit 3s linear infinite',
            zIndex: 2,
          }}
        />
        {/* Second satellite */}
        <div
          style={{
            position: 'absolute',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--space-green)',
            boxShadow: 'var(--glow-green)',
            animation: 'orbit 6s linear infinite reverse',
            top: 10,
            zIndex: 2,
          }}
        />
      </div>

      {/* Heading */}
      <div>
        <h2
          className="gradient-text"
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '0.5rem',
          }}
        >
          OrbitalWatch Dashboard
        </h2>
        <p
          style={{
            color: 'var(--space-text-muted)',
            fontSize: '1rem',
            maxWidth: 420,
            lineHeight: 1.6,
          }}
        >
          3D Globe will be added in Prompt F2.
          <br />
          The scaffold, API layer, WebSocket service, and layout shell are ready.
        </p>
      </div>

      {/* Status cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          width: '100%',
          maxWidth: 600,
        }}
      >
        {[
          { label: 'Tracked Objects', value: '—', color: 'var(--space-cyan)' },
          { label: 'Active Conjunctions', value: '—', color: 'var(--space-amber)' },
          { label: 'High Risk', value: '—', color: 'var(--space-red)' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="card"
            style={{
              textAlign: 'center',
              padding: '1.25rem 1rem',
            }}
          >
            <p
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color,
                fontVariantNumeric: 'tabular-nums',
                marginBottom: '0.25rem',
              }}
            >
              {value}
            </p>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--space-text-muted)',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Tech stack badges */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {['React 19', 'Vite 6', 'Tailwind 4', 'Three.js', 'Socket.IO', 'Recharts'].map((tech) => (
          <span key={tech} className="badge badge-cyan">
            {tech}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── App Root ──────────────────────────────────────────────────────────────────

/**
 * Root application component. Wraps the entire app in AppProvider context
 * and renders the MainLayout shell.
 *
 * @returns {JSX.Element}
 */
function App() {
  return (
    <AppProvider>
      <MainLayout>
        <DashboardPlaceholder />
      </MainLayout>
    </AppProvider>
  )
}

export default App
