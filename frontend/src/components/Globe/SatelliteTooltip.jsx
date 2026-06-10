/**
 * @fileoverview SatelliteTooltip.jsx — Drei <Html> overlay that displays
 * telemetry details for the currently hovered satellite.
 */

import PropTypes from 'prop-types'
import { Html } from '@react-three/drei'

// ── SatelliteTooltip ──────────────────────────────────────────────────────────

/**
 * An HTML overlay rendered in Three.js world-space via Drei's <Html>.
 * Displays key telemetry fields for the hovered / selected satellite.
 *
 * @param {Object} props
 * @param {string}       props.name         Satellite display name
 * @param {string}       props.norad_id     NORAD catalog number
 * @param {number|null}  props.altitude_km  Altitude above Earth surface in km
 * @param {number|null}  props.velocity_kms Velocity in km/s
 * @param {[number,number,number]} props.position Three.js world-space [x,y,z]
 * @returns {JSX.Element}
 */
function SatelliteTooltip({ name, norad_id, altitude_km, velocity_kms, position }) {
  return (
    <Html
      position={position}
      distanceFactor={8}
      style={{ pointerEvents: 'none' }}
      zIndexRange={[100, 0]}
    >
      <div
        style={{
          background: 'rgba(5, 5, 12, 0.92)',
          border: '1px solid #00d4ff',
          borderRadius: 8,
          padding: '0.6rem 0.85rem',
          minWidth: 180,
          boxShadow: '0 0 20px rgba(0, 212, 255, 0.25), 0 4px 16px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: '0.72rem',
          letterSpacing: '0.03em',
          color: '#e8e8f0',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          // Offset so the tooltip appears above the dot
          transform: 'translate(-50%, -120%)',
        }}
      >
        {/* Header row */}
        <div
          style={{
            color: '#00d4ff',
            fontWeight: 700,
            fontSize: '0.78rem',
            marginBottom: '0.35rem',
            borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
            paddingBottom: '0.3rem',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            maxWidth: 200,
          }}
          title={name}
        >
          {name || 'Unknown Satellite'}
        </div>

        {/* Data rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <Row label="NORAD" value={`#${norad_id}`} />
          <Row
            label="ALT"
            value={altitude_km != null ? `${Number(altitude_km).toFixed(0)} km` : '—'}
            color="#00ff9d"
          />
          <Row
            label="VEL"
            value={velocity_kms != null ? `${Number(velocity_kms).toFixed(2)} km/s` : '—'}
            color="#ffbb33"
          />
        </div>

        {/* Arrow pointer */}
        <div
          style={{
            position: 'absolute',
            bottom: -7,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '7px solid #00d4ff',
          }}
        />
      </div>
    </Html>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * @param {{ label: string, value: string, color?: string }} props
 */
function Row({ label, value, color = '#e8e8f0' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
      <span style={{ color: '#8888aa' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

// ── PropTypes ─────────────────────────────────────────────────────────────────

SatelliteTooltip.propTypes = {
  name: PropTypes.string.isRequired,
  norad_id: PropTypes.string.isRequired,
  altitude_km: PropTypes.number,
  velocity_kms: PropTypes.number,
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
}

SatelliteTooltip.defaultProps = {
  altitude_km: null,
  velocity_kms: null,
}

Row.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  color: PropTypes.string,
}

export default SatelliteTooltip
