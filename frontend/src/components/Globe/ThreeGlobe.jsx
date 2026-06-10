/**
 * @fileoverview ThreeGlobe.jsx — Full 3D Earth globe with real-time satellite
 * visualisation built on React Three Fiber + Drei.
 *
 * Architecture:
 *  ┌─ <Canvas> ────────────────────────────────────────────┐
 *  │  <Suspense fallback={<LoadingSphere />}>              │
 *  │    <GlobeScene satellites onSelect selectedNoradId /> │
 *  │  </Suspense>                                          │
 *  └───────────────────────────────────────────────────────┘
 *
 * GlobeScene is kept as a separate inner component so that it can use R3F
 * hooks (useFrame, useThree) which must run inside <Canvas>.
 */

import { Suspense, useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line } from '@react-three/drei'
import * as THREE from 'three'
import PropTypes from 'prop-types'

import LoadingSphere from './LoadingSphere.jsx'
import SatelliteTooltip from './SatelliteTooltip.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Radius of the Earth sphere in Three.js units. */
const R = 5

/** Maximum number of satellites rendered via InstancedMesh. */
const MAX_INSTANCES = 500

/** Colour map keyed by satellite object_type (lower-cased). */
const TYPE_COLORS = {
  payload: '#00ff9d',
  debris: '#ff4d4d',
  'rocket body': '#ff9d00',
  unknown: '#888888',
}

/** Fallback colour when object_type is not found in the map. */
const DEFAULT_COLOR = '#888888'

// ── Coordinate helpers ────────────────────────────────────────────────────────

/**
 * Converts geodetic coordinates to Three.js Cartesian coordinates.
 *
 * @param {number} lat         Latitude in degrees  (−90 … +90)
 * @param {number} lon         Longitude in degrees (−180 … +180)
 * @param {number} altitudeKm  Altitude above the surface in kilometres
 * @returns {[number, number, number]} [x, y, z]
 */
function geoToCartesian(lat, lon, altitudeKm) {
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180
  const h = altitudeKm * 0.001 // scale km → scene units

  const x = (R + h) * Math.cos(latRad) * Math.cos(lonRad)
  const z = (R + h) * Math.cos(latRad) * Math.sin(lonRad)
  const y = (R + h) * Math.sin(latRad)

  return [x, y, z]
}

// ── Earth mesh ────────────────────────────────────────────────────────────────

/** Renders the Earth sphere, atmosphere glow, and wireframe overlay. */
function EarthMesh() {
  const earthRef = useRef(/** @type {THREE.Mesh|null} */ (null))

  // Very slow self-rotation to give a sense of life
  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.04
  })

  return (
    <group>
      {/* ── Core Earth sphere ────────────────────────────────────────────── */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[R, 64, 64]} />
        <meshStandardMaterial
          color="#1a3a5c"
          roughness={0.8}
          metalness={0.2}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* ── Wireframe overlay ────────────────────────────────────────────── */}
      <mesh>
        <sphereGeometry args={[R + 0.015, 36, 36]} />
        <meshBasicMaterial
          color="#00ffff"
          wireframe
          opacity={0.08}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* ── Atmosphere glow (rendered on the back-face so it halos the sphere) */}
      <mesh>
        <sphereGeometry args={[R + 0.35, 64, 64]} />
        <meshBasicMaterial
          color="#4a90d9"
          opacity={0.15}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// ── Satellite dots (InstancedMesh) ────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Array}       props.satellites      Full satellite list from API
 * @param {Array}       props.positions       Live positions from WebSocket
 * @param {string|null} props.selectedNoradId Currently selected NORAD ID
 * @param {Function}    props.onSelect        Callback when a dot is clicked
 * @param {Function}    props.onHover         Callback when a dot is hovered
 */
function SatelliteDots({ satellites, positions, selectedNoradId, onSelect, onHover }) {
  const meshRef = useRef(/** @type {THREE.InstancedMesh|null} */ (null))
  const { raycaster } = useThree()

  // Build a fast lookup: norad_id → position data
  const posMap = useMemo(() => {
    /** @type {Map<string, Object>} */
    const m = new Map()
    positions.forEach((p) => {
      if (p.norad_id != null) m.set(String(p.norad_id), p)
    })
    return m
  }, [positions])

  // Build a fast lookup: norad_id → satellite metadata
  const satMap = useMemo(() => {
    /** @type {Map<string, Object>} */
    const m = new Map()
    satellites.forEach((s) => {
      if (s.norad_id != null) m.set(String(s.norad_id), s)
    })
    return m
  }, [satellites])

  /**
   * Satellites to render — merge catalogue data with live positions,
   * capped at MAX_INSTANCES.
   */
  const visible = useMemo(() => {
    const out = []
    for (const [noradId, pos] of posMap) {
      if (out.length >= MAX_INSTANCES) break
      const sat = satMap.get(noradId) || {}
      out.push({ ...sat, ...pos, norad_id: noradId })
    }
    return out
  }, [posMap, satMap])

  // Reusable scratch objects (avoid allocations inside useFrame)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorObj = useMemo(() => new THREE.Color(), [])

  // Update instance matrices & colours whenever visible list changes
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    visible.forEach((sat, i) => {
      const lat = sat.latitude ?? sat.lat ?? 0
      const lon = sat.longitude ?? sat.lon ?? 0
      const alt = sat.altitude_km ?? sat.altitude ?? 400

      const [x, y, z] = geoToCartesian(lat, lon, alt)

      dummy.position.set(x, y, z)
      // Scale up selected satellite
      const scale = String(sat.norad_id) === String(selectedNoradId) ? 2.2 : 1
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Colour by type
      const typeKey = (sat.object_type || sat.type || 'unknown').toLowerCase()
      const hex = TYPE_COLORS[typeKey] ?? DEFAULT_COLOR
      colorObj.set(hex)
      mesh.setColorAt(i, colorObj)
    })

    mesh.count = visible.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [visible, selectedNoradId, dummy, colorObj])

  // Click → select
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation()
      const idx = e.instanceId
      if (idx == null || idx >= visible.length) return
      onSelect(String(visible[idx].norad_id))
    },
    [visible, onSelect],
  )

  // Hover → tooltip
  const handlePointerMove = useCallback(
    (e) => {
      e.stopPropagation()
      const idx = e.instanceId
      if (idx == null || idx >= visible.length) {
        onHover(null)
        return
      }
      onHover(visible[idx])
    },
    [visible, onHover],
  )

  const handlePointerOut = useCallback(() => onHover(null), [onHover])

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, MAX_INSTANCES]}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  )
}

SatelliteDots.propTypes = {
  satellites: PropTypes.array.isRequired,
  positions: PropTypes.array.isRequired,
  selectedNoradId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onHover: PropTypes.func.isRequired,
}

// ── Orbital trail ─────────────────────────────────────────────────────────────

/**
 * Renders a simplified circular orbital trail for the selected satellite.
 * Uses 18 evenly-spaced points at ±5 min intervals around the current position.
 *
 * @param {Object} props
 * @param {Object} props.satellite  Satellite position object (lat, lon, altitude_km)
 */
function OrbitalTrail({ satellite }) {
  const TRAIL_POINTS = 18

  const points = useMemo(() => {
    const lat = satellite.latitude ?? satellite.lat ?? 0
    const lon = satellite.longitude ?? satellite.lon ?? 0
    const alt = satellite.altitude_km ?? satellite.altitude ?? 400

    // Simulate 18 trail points by stepping longitude over 90 minutes
    // (Earth's surface moves ~0.25°/min relative to a LEO satellite)
    const pts = []
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const t = i - TRAIL_POINTS / 2 // range: -9 … +8 (minutes * 5)
      const stepLon = lon + t * (360 / (90 * 60)) * 300 // 300s per step
      const [x, y, z] = geoToCartesian(lat, stepLon, alt)
      pts.push(new THREE.Vector3(x, y, z))
    }
    return pts
  }, [satellite])

  return (
    <Line
      points={points}
      color="#00d4ff"
      lineWidth={1.2}
      opacity={0.55}
      transparent
      dashed={false}
    />
  )
}

OrbitalTrail.propTypes = {
  satellite: PropTypes.object.isRequired,
}

// ── Hovered tooltip wrapper ───────────────────────────────────────────────────

/**
 * Renders <SatelliteTooltip> positioned at the hovered satellite's world-space
 * coordinates.
 *
 * @param {Object} props
 * @param {Object|null} props.hoveredSat Hovered satellite data object
 */
function HoverTooltip({ hoveredSat }) {
  if (!hoveredSat) return null

  const lat = hoveredSat.latitude ?? hoveredSat.lat ?? 0
  const lon = hoveredSat.longitude ?? hoveredSat.lon ?? 0
  const alt = hoveredSat.altitude_km ?? hoveredSat.altitude ?? 400
  const pos = geoToCartesian(lat, lon, alt)

  return (
    <SatelliteTooltip
      name={hoveredSat.name || hoveredSat.norad_id || 'Unknown'}
      norad_id={String(hoveredSat.norad_id)}
      altitude_km={typeof alt === 'number' ? alt : null}
      velocity_kms={hoveredSat.velocity_kms ?? hoveredSat.velocity ?? null}
      position={pos}
    />
  )
}

HoverTooltip.propTypes = {
  hoveredSat: PropTypes.object,
}

// ── Inner scene (runs inside Canvas context) ──────────────────────────────────

/**
 * @param {Object} props
 * @param {Array}       props.satellites
 * @param {Array}       props.positions
 * @param {string|null} props.selectedNoradId
 * @param {Function}    props.onSelect
 * @param {Function}    props.onResetCamera
 * @param {Object}      props.controlsRef
 */
function GlobeScene({ satellites, positions, selectedNoradId, onSelect, controlsRef }) {
  const [hoveredSat, setHoveredSat] = useState(/** @type {Object|null} */ (null))

  // Find the selected satellite's live position for the orbital trail
  const selectedSatPos = useMemo(() => {
    if (!selectedNoradId) return null
    return positions.find((p) => String(p.norad_id) === String(selectedNoradId)) ?? null
  }, [selectedNoradId, positions])

  return (
    <>
      {/* ── Lighting ──────────────────────────────────────────────────────── */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#00d4ff" />

      {/* ── Background stars ──────────────────────────────────────────────── */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      {/* ── Earth ─────────────────────────────────────────────────────────── */}
      <EarthMesh />

      {/* ── Satellite dots ────────────────────────────────────────────────── */}
      <SatelliteDots
        satellites={satellites}
        positions={positions}
        selectedNoradId={selectedNoradId}
        onSelect={onSelect}
        onHover={setHoveredSat}
      />

      {/* ── Orbital trail for selected satellite ──────────────────────────── */}
      {selectedSatPos && <OrbitalTrail satellite={selectedSatPos} />}

      {/* ── Hover tooltip ─────────────────────────────────────────────────── */}
      <HoverTooltip hoveredSat={hoveredSat} />

      {/* ── Camera controls ───────────────────────────────────────────────── */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={8}
        maxDistance={30}
        autoRotate
        autoRotateSpeed={0.5}
        makeDefault
      />
    </>
  )
}

GlobeScene.propTypes = {
  satellites: PropTypes.array.isRequired,
  positions: PropTypes.array.isRequired,
  selectedNoradId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  controlsRef: PropTypes.object.isRequired,
}

// ── ThreeGlobe (public component) ─────────────────────────────────────────────

/**
 * Root Three.js globe component. Renders a <Canvas> that fills its container.
 *
 * @param {Object}      props
 * @param {Array}       props.satellites      Full satellite catalogue (from API)
 * @param {Array}       props.positions       Live positions (from WebSocket)
 * @param {string|null} props.selectedNoradId Currently selected satellite NORAD ID
 * @param {Function}    props.onSelect        Called with norad_id string when user clicks a dot
 * @param {Object}      [props.controlsRef]   External ref forwarded to OrbitControls
 * @returns {JSX.Element}
 */
function ThreeGlobe({ satellites, positions, selectedNoradId, onSelect, controlsRef }) {
  const internalRef = useRef(null)
  const resolvedRef = controlsRef ?? internalRef

  return (
    <Canvas
      camera={{ position: [0, 0, 18], fov: 45 }}
      style={{ background: '#000010', width: '100%', height: '100%' }}
      dpr={[1, 2]}
      shadows
    >
      <Suspense fallback={<LoadingSphere />}>
        <GlobeScene
          satellites={satellites}
          positions={positions}
          selectedNoradId={selectedNoradId}
          onSelect={onSelect}
          controlsRef={resolvedRef}
        />
      </Suspense>
    </Canvas>
  )
}

ThreeGlobe.propTypes = {
  satellites: PropTypes.array.isRequired,
  positions: PropTypes.array.isRequired,
  selectedNoradId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  controlsRef: PropTypes.object,
}

ThreeGlobe.defaultProps = {
  selectedNoradId: null,
  controlsRef: null,
}

export default ThreeGlobe
