/**
 * @fileoverview ThreeGlobe.jsx — Full 3D Earth globe with real-time satellite
 * visualisation built on React Three Fiber + Drei. Upgraded with NASA Blue Marble
 * texture, Fresnel atmosphere glow, pulsing selection indicators,
 * custom procedural fallbacks, and smart camera follow/lock behavior.
 *
 * Architecture:
 *  ┌─ <Canvas> ────────────────────────────────────────────┐
 *  │  <Suspense fallback={<LoadingSphere />}>              │
 *  │    <GlobeScene satellites onSelect selectedNoradId /> │
 *  │  </Suspense>                                          │
 *  └───────────────────────────────────────────────────────┘
 */

import { Suspense, useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import PropTypes from 'prop-types'

import LoadingSphere from './LoadingSphere.jsx'
import SatelliteTooltip from './SatelliteTooltip.jsx'
import { useAppContext } from '../../context/AppContext.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Radius of the Earth sphere in Three.js units. */
const R = 6.5

/** Maximum number of satellites rendered via InstancedMesh. */
const MAX_INSTANCES = 500

// ── Coordinate helpers ────────────────────────────────────────────────────────

/**
 * Converts geodetic coordinates to Three.js Cartesian coordinates.
 *
 * @param {number} lat         Latitude in degrees  (−90 … +90)
 * @param {number} lon         Longitude in degrees (−180 … +180)
 * @param {number} altitudeKm  Altitude above the surface in kilometres
 * @returns {[number, number, number]} [x, y, z]
 */
const KM_TO_UNIT = 6.5 / 6378.137

function geoToCartesian(lat, lon, altitudeKm) {
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180
  const h = altitudeKm * KM_TO_UNIT // scale km → scene units

  const x = (R + h) * Math.cos(latRad) * Math.cos(lonRad)
  const z = (R + h) * Math.cos(latRad) * Math.sin(lonRad)
  const y = (R + h) * Math.sin(latRad)

  return [x, y, z]
}

const LAUNCH_SITE_COORDS = {
  'Cape Canaveral': { lat: 28.5383, lon: -80.6489 },
  'Baikonur': { lat: 45.9650, lon: 63.3050 },
  'Kourou': { lat: 5.1597, lon: -52.6502 },
  'Vandenberg': { lat: 34.7420, lon: -120.5724 }
}

function eciToThree(pos) {
  return new THREE.Vector3(pos.x * KM_TO_UNIT, pos.z * KM_TO_UNIT, pos.y * KM_TO_UNIT)
}

function getOrbitPoints(altitudeKm, inclinationDeg, eccentricity, raanDeg, argPerigeeDeg = 0, numPoints = 180) {
  const a = R + altitudeKm * KM_TO_UNIT // Semi-major axis in scene units
  const e = eccentricity
  const inc = (inclinationDeg * Math.PI) / 180
  const raan = (raanDeg * Math.PI) / 180
  const argP = (argPerigeeDeg * Math.PI) / 180

  const points = []
  for (let i = 0; i <= numPoints; i++) {
    const nu = (i * 2 * Math.PI) / numPoints // True anomaly
    const r_orb = (a * (1 - e * e)) / (1 + e * Math.cos(nu))

    const x_p = r_orb * Math.cos(nu)
    const y_p = r_orb * Math.sin(nu)

    const cosRaan = Math.cos(raan)
    const sinRaan = Math.sin(raan)
    const cosArgP = Math.cos(argP)
    const sinArgP = Math.sin(argP)
    const cosInc = Math.cos(inc)
    const sinInc = Math.sin(inc)

    const x_eci = x_p * (cosRaan * cosArgP - sinRaan * sinArgP * cosInc) - y_p * (cosRaan * sinArgP + sinRaan * cosArgP * cosInc)
    const y_eci = x_p * (sinRaan * cosArgP + cosRaan * sinArgP * cosInc) - y_p * (sinRaan * sinArgP - cosRaan * cosArgP * cosInc)
    const z_eci = x_p * (sinArgP * sinInc) + y_p * (cosArgP * sinInc)

    points.push(new THREE.Vector3(x_eci, z_eci, y_eci))
  }
  return points;
}

// ── Procedural Fallbacks ──────────────────────────────────────────────────────


/** Generates a clean, stylized procedural Earth texture if loading fails. */
function createProceduralEarth() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Deep blue ocean background
  ctx.fillStyle = '#0f1c3f'
  ctx.fillRect(0, 0, 1024, 512)

  // Draw landmasses
  ctx.fillStyle = '#1e3820'
  
  // North America
  ctx.beginPath()
  ctx.arc(240, 180, 70, 0, Math.PI * 2)
  ctx.arc(300, 200, 40, 0, Math.PI * 2)
  ctx.fill()

  // South America
  ctx.beginPath()
  ctx.arc(320, 340, 60, 0, Math.PI * 2)
  ctx.arc(300, 280, 50, 0, Math.PI * 2)
  ctx.fill()

  // Eurasia
  ctx.beginPath()
  ctx.arc(640, 160, 90, 0, Math.PI * 2)
  ctx.arc(760, 180, 80, 0, Math.PI * 2)
  ctx.arc(560, 180, 60, 0, Math.PI * 2)
  ctx.fill()

  // Africa
  ctx.beginPath()
  ctx.arc(600, 320, 70, 0, Math.PI * 2)
  ctx.arc(640, 280, 50, 0, Math.PI * 2)
  ctx.fill()

  // Australia
  ctx.beginPath()
  ctx.arc(860, 360, 44, 0, Math.PI * 2)
  ctx.fill()

  // Soften continent edges for a realistic visual blend
  ctx.filter = 'blur(12px)'
  ctx.drawImage(canvas, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

// ── Atmosphere shader ─────────────────────────────────────────────────────────

const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      // Atmospheric glow halo based on eye-space normals
      float intensity = pow(0.65 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
      gl_FragColor = vec4(0.3, 0.65, 1.0, 1.0) * intensity * 0.7;
    }
  `
}

// ── Earth mesh ────────────────────────────────────────────────────────────────

/** Renders a high-quality NASA-style Earth sphere and glow halo. */
function EarthMesh({ paused }) {
  const earthRef = useRef(/** @type {THREE.Mesh|null} */ (null))

  const [earthTexture, setEarthTexture] = useState(/** @type {THREE.Texture|null} */ (null))

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    
    loader.load(
      '/earth-texture.jpg',
      (tex) => {
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.generateMipmaps = true
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        setEarthTexture(tex)
      },
      undefined,
      (err) => {
        console.warn('Failed to load Earth texture, generating fallback:', err)
        const fallbackTex = createProceduralEarth()
        if (fallbackTex) {
          fallbackTex.colorSpace = THREE.SRGBColorSpace
          setEarthTexture(fallbackTex)
        }
      }
    )
  }, [])

  // Rotate Earth slowly, but pause during active launch simulation or design phase
  useFrame((_, delta) => {
    if (earthRef.current && !paused) {
      earthRef.current.rotation.y += delta * 0.015
    }
  })

  return (
    <group>
      {/* ── Core Earth sphere ────────────────────────────────────────────── */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[R, 64, 64]} />
        <meshStandardMaterial
          key={earthTexture ? 'textured' : 'solid'}
          map={earthTexture}
          color={earthTexture ? '#ffffff' : '#0f1c3f'}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* ── Subtle mission-control wireframe grid overlay ───────────────── */}
      <mesh>
        <sphereGeometry args={[R + 0.015, 36, 36]} />
        <meshBasicMaterial
          color="#2a5d91"
          wireframe
          opacity={0.05}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* ── Atmosphere glow halo ─────────────────────────────────────────── */}
      <mesh>
        <sphereGeometry args={[R * 1.03, 64, 64]} />
        <shaderMaterial
          vertexShader={AtmosphereShader.vertexShader}
          fragmentShader={AtmosphereShader.fragmentShader}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

EarthMesh.propTypes = {
  paused: PropTypes.bool,
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
  const [hoveredInstanceId, setHoveredInstanceId] = useState(null)
  const { raycaster, camera, pointer } = useThree()

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

  // Update instance matrices & colours whenever visible list or satellites prop changes
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    visible.forEach((sat, i) => {
      const lat = sat.latitude ?? sat.lat ?? 0
      const lon = sat.longitude ?? sat.lon ?? 0
      const alt = sat.altitude_km ?? sat.altitude ?? 400

      const [x, y, z] = geoToCartesian(lat, lon, alt)

      dummy.position.set(x, y, z)
      // Initial scale: selected satellite starts larger
      const scale = String(sat.norad_id) === String(selectedNoradId) ? 2.4 : 1
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Create a THREE.Color object from the satellite's type
      const typeKey = (sat.object_type || sat.type || 'unknown').toLowerCase()
      let color
      if (typeKey === 'payload') {
        color = new THREE.Color('#00ff9d')
      } else if (typeKey === 'debris') {
        color = new THREE.Color('#ff4d4d')
      } else if (typeKey === 'rocket body') {
        color = new THREE.Color('#ff9d00')
      } else {
        color = new THREE.Color('#888888')
      }
      mesh.setColorAt(i, color)
    })

    mesh.count = visible.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  }, [visible, selectedNoradId, dummy, satellites])

  // Pulse the selected satellite instance's scale in the frame loop
  useFrame(({ clock }) => {
    if (!selectedNoradId || !meshRef.current) return

    const idx = visible.findIndex((sat) => String(sat.norad_id) === String(selectedNoradId))
    if (idx === -1) return

    const sat = visible[idx]
    const lat = sat.latitude ?? sat.lat ?? 0
    const lon = sat.longitude ?? sat.lon ?? 0
    const alt = sat.altitude_km ?? sat.altitude ?? 400
    const [x, y, z] = geoToCartesian(lat, lon, alt)

    // Pulse scale between 1.9 and 2.9
    const s = 2.1 + Math.sin(clock.getElapsedTime() * 7.5) * 0.4

    dummy.position.set(x, y, z)
    dummy.scale.setScalar(s)
    dummy.updateMatrix()
    meshRef.current.setMatrixAt(idx, dummy.matrix)
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  // Custom raycasting inside useFrame for hover detection
  useFrame(() => {
    if (!meshRef.current) return
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(meshRef.current)
    let newHoveredId = null
    if (intersects.length > 0) {
      const instId = intersects[0].instanceId
      if (instId !== undefined && instId < visible.length) {
        newHoveredId = instId
      }
    }

    setHoveredInstanceId((prev) => {
      if (prev !== newHoveredId) {
        return newHoveredId
      }
      return prev
    })
  })

  // Sync hovered instance data to parent component
  useEffect(() => {
    if (hoveredInstanceId !== null && hoveredInstanceId < visible.length) {
      onHover(visible[hoveredInstanceId])
    } else {
      onHover(null)
    }
  }, [hoveredInstanceId, visible, onHover])

  // Click → select
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation()
      if (hoveredInstanceId !== null && hoveredInstanceId < visible.length) {
        onSelect(String(visible[hoveredInstanceId].norad_id))
      }
    },
    [hoveredInstanceId, visible, onSelect],
  )

  const handlePointerOut = useCallback(() => {
    setHoveredInstanceId(null)
  }, [])

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, MAX_INSTANCES]}
      onClick={handleClick}
      onPointerOut={handlePointerOut}
      frustumCulled={false}
      castShadow={false}
    >
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshStandardMaterial
        roughness={0.5}
        metalness={0.1}
        color={new THREE.Color('white')}
      />
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
 * Renders a glowing orbital trail for the selected satellite.
 *
 * @param {Object} props
 * @param {Object} props.satellite  Satellite position object (lat, lon, altitude_km)
 */
function OrbitalTrail({ satellite }) {
  const TRAIL_POINTS = 36 // Smooth curves

  const points = useMemo(() => {
    const lat = satellite.latitude ?? satellite.lat ?? 0
    const lon = satellite.longitude ?? satellite.lon ?? 0
    const alt = satellite.altitude_km ?? satellite.altitude ?? 400

    const pts = []
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const t = i - TRAIL_POINTS / 2
      const stepLon = lon + t * (360 / (90 * 60)) * 150
      const [x, y, z] = geoToCartesian(lat, stepLon, alt)
      pts.push(new THREE.Vector3(x, y, z))
    }
    return pts
  }, [satellite])

  return (
    <group>
      {/* Thicker soft glowing trail line */}
      <Line
        points={points}
        color="#00d4ff"
        lineWidth={3.0}
        opacity={0.3}
        transparent
        depthWrite={false}
      />
      {/* Thin, hot white core line */}
      <Line
        points={points}
        color="#ffffff"
        lineWidth={1.2}
        opacity={0.8}
        transparent
        depthWrite={false}
      />
    </group>
  )
}

OrbitalTrail.propTypes = {
  satellite: PropTypes.object.isRequired,
}

// ── Selected Satellite Glowing Ring ───────────────────────────────────────────

/**
 * Renders a pulsing glowing ring around the selected satellite that always faces the camera.
 *
 * @param {Object} props
 * @param {[number, number, number]} props.position Cartesian coordinates
 */
function SelectedSatelliteRing({ position }) {
  const ringRef = useRef(null)

  useFrame(({ clock, camera }) => {
    if (ringRef.current) {
      // Rotate mesh to face camera
      ringRef.current.quaternion.copy(camera.quaternion)
      // Pulse scale between 1.0 and 1.8
      const s = 1.0 + Math.sin(clock.getElapsedTime() * 7) * 0.4
      ringRef.current.scale.set(s, s, s)
    }
  })

  return (
    <mesh ref={ringRef} position={position}>
      <ringGeometry args={[0.16, 0.24, 32]} />
      <meshBasicMaterial
        color="#00ffff"
        transparent
        opacity={0.8}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

SelectedSatelliteRing.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
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

function ProposedOrbitRing({ proposedOrbit, simulationResult, simLaunched }) {
  const points = useMemo(() => {
    if (simLaunched || !proposedOrbit) return []
    if (simulationResult && simulationResult.proposedOrbitPoints) {
      return simulationResult.proposedOrbitPoints.map((p) => eciToThree(p))
    }
    const { altitudeKm, inclination, eccentricity, raan } = proposedOrbit
    const solvedRaan = raan === '' || raan === null ? 0.0 : Number(raan)
    return getOrbitPoints(Number(altitudeKm), Number(inclination), Number(eccentricity), solvedRaan)
  }, [proposedOrbit, simulationResult, simLaunched])

  const color = useMemo(() => {
    if (!simulationResult) return '#ffffff'
    const status = simulationResult.status
    if (status === 'APPROVED') return '#00ff9d'
    if (status === 'REJECTED') return '#ff4466'
    if (status === 'WARNING') return '#ffbb33'
    return '#ffffff'
  }, [simulationResult])

  if (simLaunched || !proposedOrbit || points.length === 0) return null

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.6}
      opacity={0.6}
      transparent
    />
  )
}

ProposedOrbitRing.propTypes = {
  proposedOrbit: PropTypes.object,
  simulationResult: PropTypes.object,
  simLaunched: PropTypes.bool,
}

function SimulationTrajectory({ proposedOrbit, simulationResult, simLaunched }) {
  const [time, setTime] = useState(0)

  useEffect(() => {
    setTime(0)
  }, [simulationResult, proposedOrbit])

  useFrame((_, delta) => {
    if (simLaunched && proposedOrbit) {
      setTime((t) => t + delta)
    }
  })

  const { points, ascentPoints, color } = useMemo(() => {
    if (!simLaunched || !proposedOrbit || !simulationResult) return {}
    const { altitudeKm, inclination, eccentricity, raan, launchSite } = proposedOrbit
    const solvedRaan = raan === '' || raan === null ? 0.0 : Number(raan)
    const pts = simulationResult.proposedOrbitPoints
      ? simulationResult.proposedOrbitPoints.map((p) => eciToThree(p))
      : getOrbitPoints(Number(altitudeKm), Number(inclination), Number(eccentricity), solvedRaan)

    const site = LAUNCH_SITE_COORDS[launchSite] || LAUNCH_SITE_COORDS['Cape Canaveral']
    const startPos = new THREE.Vector3(...geoToCartesian(site.lat, site.lon, 0))
    const endPos = pts[0]
    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
    const controlPoint = midPoint.clone().normalize().multiplyScalar(6.5 + altitudeKm * 0.0005)
    
    const curve = new THREE.QuadraticBezierCurve3(startPos, controlPoint, endPos)
    const ascPts = curve.getPoints(40)

    const isRej = simulationResult.status === 'REJECTED'
    const clr = simulationResult.status === 'APPROVED' ? '#00ff9d' : isRej ? '#ff4466' : '#ffbb33'

    return { points: pts, ascentPoints: ascPts, color: clr }
  }, [proposedOrbit, simulationResult, simLaunched])

  if (!simLaunched || !proposedOrbit || !points || points.length === 0) return null

  const isAscent = time < 3.0
  
  let currentPos = new THREE.Vector3()
  if (isAscent) {
    const t = time / 3.0
    const index = Math.min(Math.floor(t * (ascentPoints?.length || 1)), (ascentPoints?.length || 1) - 1)
    if (ascentPoints && ascentPoints[index]) currentPos.copy(ascentPoints[index])
  } else {
    const elapsed = time - 3.0
    const idx = Math.floor(elapsed * 25) % points.length
    if (points[idx]) currentPos.copy(points[idx])
  }

  return (
    <group>
      {isAscent && ascentPoints && (
        <Line
          points={ascentPoints}
          color="#ffaa00"
          lineWidth={2.0}
          opacity={0.8}
          transparent
        />
      )}

      {!isAscent && (
        <group>
          <Line
            points={points}
            color={color}
            lineWidth={1.8}
            opacity={0.7}
            transparent
          />
          <Line
            points={points}
            color={color}
            lineWidth={4.0}
            opacity={0.15}
            transparent
          />
        </group>
      )}

      <mesh position={currentPos}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={isAscent ? '#ffff88' : color} />
      </mesh>
      
      <mesh position={currentPos}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={isAscent ? '#ffaa00' : color} transparent opacity={0.25} wireframe />
      </mesh>

    </group>
  )
}

SimulationTrajectory.propTypes = {
  proposedOrbit: PropTypes.object,
  simulationResult: PropTypes.object,
  simLaunched: PropTypes.bool,
}

function ConjunctionHighlighter({ proposedOrbit, simulationResult, simLaunched }) {
  const [time, setTime] = useState(0)

  useEffect(() => {
    setTime(0)
  }, [simLaunched])

  useFrame((_, delta) => {
    if (simLaunched) {
      setTime((t) => t + delta)
    }
  })

  const { p1, p2, color } = useMemo(() => {
    if (!proposedOrbit || !simulationResult) return {}
    const pt1 = simulationResult.proposedPos ? eciToThree(simulationResult.proposedPos) : null
    const pt2 = simulationResult.conflictPos ? eciToThree(simulationResult.conflictPos) : null
    const isRej = simulationResult.status === 'REJECTED'
    const isWarn = simulationResult.status === 'WARNING'
    const clr = isRej ? '#ff4466' : isWarn ? '#ffbb33' : '#00ffff'
    return { p1: pt1, p2: pt2, color: clr }
  }, [proposedOrbit, simulationResult])

  if (!proposedOrbit || !p1 || !p2) return null

  // If launched, hide the highlight during the 3-second ascent phase
  if (simLaunched && time < 3.0) return null

  return (
    <group>
      <Line
        points={[p1, p2]}
        color={color}
        lineWidth={2.5}
        opacity={0.9}
        transparent
      />

      <mesh position={p1}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={p1}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} wireframe />
      </mesh>

      <mesh position={p2}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#ff4466" />
      </mesh>
      <mesh position={p2}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#ff4466" transparent opacity={0.3} wireframe />
      </mesh>
      <mesh position={p2}>
        <ringGeometry args={[0.22, 0.32, 32]} />
        <meshBasicMaterial color="#ff4466" side={THREE.DoubleSide} transparent opacity={0.7} />
      </mesh>

      <Html position={p1} distanceFactor={15}>
        <div
          style={{
            background: 'rgba(0, 212, 255, 0.92)',
            color: '#000000',
            padding: '3px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            transform: 'translate(-50%, -140%)',
            pointerEvents: 'none',
          }}
        >
          🛰️ Proposed Orbit
        </div>
      </Html>

      <Html position={p2} distanceFactor={15}>
        <div
          style={{
            background: 'rgba(255, 68, 102, 0.92)',
            color: '#ffffff',
            padding: '3px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            transform: 'translate(-50%, -140%)',
            pointerEvents: 'none',
          }}
        >
          ⚠️ {simulationResult.conflictingObject?.name || 'Conflict Object'}
        </div>
      </Html>
    </group>
  )
}

ConjunctionHighlighter.propTypes = {
  proposedOrbit: PropTypes.object,
  simulationResult: PropTypes.object,
  simLaunched: PropTypes.bool,
}

function CatalogConjunctionHighlighter({ conjunction, positions }) {
  const [time, setTime] = useState(0)

  useFrame((_, delta) => {
    setTime((t) => t + delta)
  })

  const { p1, p2, sat1Name, sat2Name, riskLevel } = useMemo(() => {
    if (!conjunction) return {}
    const nid1 = String(conjunction.sat1_norad_id ?? conjunction.satellite1_norad ?? conjunction.norad1 ?? '')
    const nid2 = String(conjunction.sat2_norad_id ?? conjunction.satellite2_norad ?? conjunction.norad2 ?? '')
    const pData1 = positions.find((p) => String(p.norad_id) === nid1)
    const pData2 = positions.find((p) => String(p.norad_id) === nid2)

    if (!pData1 || !pData2) return {}

    const pt1 = geoToCartesian(pData1.latitude ?? pData1.lat ?? 0, pData1.longitude ?? pData1.lon ?? 0, pData1.altitude_km ?? pData1.alt ?? 400)
    const pt2 = geoToCartesian(pData2.latitude ?? pData2.lat ?? 0, pData2.longitude ?? pData2.lon ?? 0, pData2.altitude_km ?? pData2.alt ?? 400)

    return {
      p1: new THREE.Vector3(...pt1),
      p2: new THREE.Vector3(...pt2),
      sat1Name: conjunction.sat1_name ?? conjunction.satellite1_name ?? pData1.name ?? `Sat ${nid1}`,
      sat2Name: conjunction.sat2_name ?? conjunction.satellite2_name ?? pData2.name ?? `Sat ${nid2}`,
      riskLevel: conjunction.risk_level ?? 'LOW',
    }
  }, [conjunction, positions])

  if (!p1 || !p2) return null

  const riskColor = riskLevel === 'HIGH' ? '#ff4d4d' : riskLevel === 'MEDIUM' ? '#ff9d00' : '#00ff9d'
  const linePoints = [p1, p2]

  const pulse = 1.0 + Math.sin(time * 8) * 0.15

  return (
    <group>
      <Line
        points={linePoints}
        color={riskColor}
        lineWidth={2.5 * pulse}
        opacity={0.8}
        transparent
        depthWrite={false}
      />
      <Line
        points={linePoints}
        color={riskColor}
        lineWidth={6.0 * pulse}
        opacity={0.15}
        transparent
        depthWrite={false}
      />

      <mesh position={p1}>
        <sphereGeometry args={[0.16 * pulse, 16, 16]} />
        <meshBasicMaterial color={riskColor} transparent opacity={0.6} />
      </mesh>
      <mesh position={p2}>
        <sphereGeometry args={[0.16 * pulse, 16, 16]} />
        <meshBasicMaterial color={riskColor} transparent opacity={0.6} />
      </mesh>

      <Html position={new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)} distanceFactor={14}>
        <div
          style={{
            background: 'rgba(10, 10, 18, 0.92)',
            border: `1px solid ${riskColor}`,
            color: '#e8e8f0',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '9px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
            transform: 'translate(-50%, -120%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ fontWeight: 'bold', color: riskColor, letterSpacing: '0.05em' }}>
            ⚠️ CLOSE APPROACH ALERT ({riskLevel})
          </div>
          <div>
            Objects: {sat1Name} + {sat2Name}
          </div>
          <div>
            Separation: {(conjunction.miss_distance_km ?? conjunction.miss_distance ?? 0.0).toFixed(3)} km
          </div>
          <div>
            Rel Velocity: {(conjunction.relative_velocity ?? conjunction.rel_velocity ?? 7.5).toFixed(1)} km/s
          </div>
          <div>
            Probability: {((conjunction.collision_probability ?? conjunction.probability ?? 0.0) * 100).toFixed(3)}%
          </div>
        </div>
      </Html>
    </group>
  )
}

CatalogConjunctionHighlighter.propTypes = {
  conjunction: PropTypes.object,
  positions: PropTypes.array,
}

// ── Inner scene (runs inside Canvas context) ──────────────────────────────────

/**
 * @param {Object} props
 * @param {Array}       props.satellites
 * @param {Array}       props.positions
 * @param {string|null} props.selectedNoradId
 * @param {Function}    props.onSelect
 * @param {Object}      props.controlsRef
 */
function GlobeScene({ satellites, positions, selectedNoradId, onSelect, controlsRef, proposedOrbit, simulationResult, simLaunched }) {
  const { focusedConjunction } = useAppContext()
  const [hoveredSat, setHoveredSat] = useState(/** @type {Object|null} */ (null))
  const [followActive, setFollowActive] = useState(false)
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(0.5)
  const [conflictFocusPoint, setConflictFocusPoint] = useState(null)

  const focusedMidpoint = useMemo(() => {
    if (!focusedConjunction) return null
    const nid1 = String(focusedConjunction.sat1_norad_id ?? focusedConjunction.satellite1_norad ?? focusedConjunction.norad1 ?? '')
    const nid2 = String(focusedConjunction.sat2_norad_id ?? focusedConjunction.satellite2_norad ?? focusedConjunction.norad2 ?? '')
    const pData1 = positions.find((p) => String(p.norad_id) === nid1)
    const pData2 = positions.find((p) => String(p.norad_id) === nid2)
    if (!pData1 || !pData2) return null

    const pt1 = geoToCartesian(pData1.latitude ?? pData1.lat ?? 0, pData1.longitude ?? pData1.lon ?? 0, pData1.altitude_km ?? pData1.alt ?? 400)
    const pt2 = geoToCartesian(pData2.latitude ?? pData2.lat ?? 0, pData2.longitude ?? pData2.lon ?? 0, pData2.altitude_km ?? pData2.alt ?? 400)

    return new THREE.Vector3().addVectors(
      new THREE.Vector3(...pt1),
      new THREE.Vector3(...pt2)
    ).multiplyScalar(0.5)
  }, [focusedConjunction, positions])

  // Listen to camera follow and demo events
  useEffect(() => {
    const handleFollow = () => {
      setFollowActive((prev) => !prev)
      setConflictFocusPoint(null)
    }
    const handleDemoSelect = () => {
      // Auto-focus and follow in demo mode
      setFollowActive(true)
      setConflictFocusPoint(null)
    }
    const handleAutoRotate = (e) => {
      const { enabled, speed } = e.detail ?? {}
      setAutoRotateSpeed(enabled ? speed : 0.5)
    }
    const handleZoomToConflict = (e) => {
      const { position } = e.detail ?? {}
      if (position) {
        setFollowActive(false)
        setConflictFocusPoint(new THREE.Vector3(...position))
      }
    }
    const handleResetCamera = () => {
      setFollowActive(false)
      setConflictFocusPoint(null)
      if (controlsRef.current) {
        controlsRef.current.reset()
      }
    }

    window.addEventListener('ow:follow-satellite', handleFollow)
    window.addEventListener('ow:demo-select-satellite', handleDemoSelect)
    window.addEventListener('ow:demo-auto-rotate', handleAutoRotate)
    window.addEventListener('ow:zoom-to-conflict', handleZoomToConflict)
    window.addEventListener('ow:reset-camera', handleResetCamera)

    return () => {
      window.removeEventListener('ow:follow-satellite', handleFollow)
      window.removeEventListener('ow:demo-select-satellite', handleDemoSelect)
      window.removeEventListener('ow:demo-auto-rotate', handleAutoRotate)
      window.removeEventListener('ow:zoom-to-conflict', handleZoomToConflict)
      window.removeEventListener('ow:reset-camera', handleResetCamera)
    }
  }, [controlsRef])

  // Auto-disable follow if selection is cleared
  useEffect(() => {
    if (!selectedNoradId) {
      setFollowActive(false)
    }
  }, [selectedNoradId])

  // Find the selected satellite's live position for the orbital trail and camera follow
  const selectedSatPos = useMemo(() => {
    if (!selectedNoradId) return null
    return positions.find((p) => String(p.norad_id) === String(selectedNoradId)) ?? null
  }, [selectedNoradId, positions])

  // Get selected satellite position coordinates
  const selectedSatCartesian = useMemo(() => {
    if (!selectedSatPos) return null
    const lat = selectedSatPos.latitude ?? selectedSatPos.lat ?? 0
    const lon = selectedSatPos.longitude ?? selectedSatPos.lon ?? 0
    const alt = selectedSatPos.altitude_km ?? selectedSatPos.altitude ?? 400
    return geoToCartesian(lat, lon, alt)
  }, [selectedSatPos])

  // Camera follow / target centering in useFrame
  useFrame(({ camera }) => {
    if (focusedMidpoint && controlsRef.current) {
      controlsRef.current.target.lerp(focusedMidpoint, 0.1)
      const cameraTargetDist = camera.position.distanceTo(focusedMidpoint)
      if (cameraTargetDist > 14.0) {
        const dir = camera.position.clone().sub(focusedMidpoint).normalize()
        camera.position.lerp(focusedMidpoint.clone().add(dir.multiplyScalar(13.0)), 0.08)
      }
      controlsRef.current.update()
    } else if (followActive && selectedSatCartesian && controlsRef.current) {
      const [x, y, z] = selectedSatCartesian
      const targetVec = new THREE.Vector3(x, y, z)
      // Smoothly interpolate the controls target to the satellite position
      controlsRef.current.target.lerp(targetVec, 0.1)
      controlsRef.current.update()
    } else if (conflictFocusPoint && controlsRef.current) {
      controlsRef.current.target.lerp(conflictFocusPoint, 0.1)
      // Zoom close to conflict coordinate
      const cameraTargetDist = camera.position.distanceTo(conflictFocusPoint)
      if (cameraTargetDist > 3.0) {
        const dir = camera.position.clone().sub(conflictFocusPoint).normalize()
        camera.position.lerp(conflictFocusPoint.clone().add(dir.multiplyScalar(2.5)), 0.08)
      }
      controlsRef.current.update()
    } else if (controlsRef.current) {
      // Lerp controls target back to Earth's center
      const centerVec = new THREE.Vector3(0, 0, 0)
      if (controlsRef.current.target.distanceTo(centerVec) > 0.001) {
        controlsRef.current.target.lerp(centerVec, 0.1)
        controlsRef.current.update()
      }
    }
  })

  return (
    <>
      {/* ── Lighting ──────────────────────────────────────────────────────── */}
      <ambientLight intensity={0.8} />
      {/* Direct Sun light */}
      <directionalLight position={[10, 5, 10]} intensity={2.5} castShadow />
      {/* Subtle back rim light for atmospheric outline pop */}
      <directionalLight position={[-12, -6, -12]} intensity={1.5} color="#0088ff" />
      {/* Dark side fill point light */}
      <pointLight position={[-10, -5, -10]} intensity={0.8} color="#2266aa" />

      {/* ── Cinematic Stars field background ──────────────────────────────── */}
      <Stars radius={300} depth={150} count={15000} factor={6} saturation={0.8} fade speed={1.5} />

      {/* ── Earth sphere, atmosphere glow halo ──────────────── */}
      <EarthMesh paused={proposedOrbit !== null || simLaunched} />

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

      {/* ── Conjunction Highlighter for Catalog Conjunctions ─────────────── */}
      {focusedConjunction && (
        <>
          <CatalogConjunctionHighlighter conjunction={focusedConjunction} positions={positions} />
          {positions.find((p) => String(p.norad_id) === String(focusedConjunction.sat1_norad_id)) && (
            <OrbitalTrail satellite={positions.find((p) => String(p.norad_id) === String(focusedConjunction.sat1_norad_id))} />
          )}
          {positions.find((p) => String(p.norad_id) === String(focusedConjunction.sat2_norad_id)) && (
            <OrbitalTrail satellite={positions.find((p) => String(p.norad_id) === String(focusedConjunction.sat2_norad_id))} />
          )}
        </>
      )}
      
      {/* ── Proposed Orbit Ghost Ring ────────────────────────────────────── */}
      <ProposedOrbitRing proposedOrbit={proposedOrbit} simulationResult={simulationResult} simLaunched={simLaunched} />

      {/* ── Simulation Trajectory & Conjunction Highlighter ───────────────── */}
      <SimulationTrajectory proposedOrbit={proposedOrbit} simulationResult={simulationResult} simLaunched={simLaunched} />

      {/* ── Conjunction Highlighter (pulsing markers & labels at TCA) ── */}
      <ConjunctionHighlighter proposedOrbit={proposedOrbit} simulationResult={simulationResult} simLaunched={simLaunched} />

      {/* ── Pulsing glowing ring for selected satellite ───────────────────── */}
      {selectedSatCartesian && <SelectedSatelliteRing position={selectedSatCartesian} />}

      {/* ── Hover tooltip ─────────────────────────────────────────────────── */}
      <HoverTooltip hoveredSat={hoveredSat} />

      {/* ── Camera controls ───────────────────────────────────────────────── */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={9}
        maxDistance={35}
        autoRotate={!followActive && !simLaunched && !proposedOrbit}
        autoRotateSpeed={autoRotateSpeed}
        target={[0, 0, 0]}
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
function ThreeGlobe({ satellites, positions, selectedNoradId, onSelect, controlsRef, proposedOrbit, simulationResult, simLaunched }) {
  const internalRef = useRef(null)
  const resolvedRef = controlsRef ?? internalRef

  return (
    <Canvas
      camera={{ position: [0, 0, 20], fov: 50 }}
      style={{ background: '#000010', width: '100%', height: '100%', zIndex: 10 }}
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
          proposedOrbit={proposedOrbit}
          simulationResult={simulationResult}
          simLaunched={simLaunched}
        />
      </Suspense>
    </Canvas>
  )
}

GlobeScene.propTypes = {
  satellites: PropTypes.array,
  positions: PropTypes.array,
  selectedNoradId: PropTypes.string,
  onSelect: PropTypes.func,
  controlsRef: PropTypes.object,
  proposedOrbit: PropTypes.object,
  simulationResult: PropTypes.object,
  simLaunched: PropTypes.bool,
}

ThreeGlobe.propTypes = {
  satellites: PropTypes.array.isRequired,
  positions: PropTypes.array.isRequired,
  selectedNoradId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  controlsRef: PropTypes.object,
  proposedOrbit: PropTypes.object,
  simulationResult: PropTypes.object,
  simLaunched: PropTypes.bool,
}

ThreeGlobe.defaultProps = {
  selectedNoradId: null,
  controlsRef: null,
  proposedOrbit: null,
  simulationResult: null,
  simLaunched: false,
}

export default ThreeGlobe
