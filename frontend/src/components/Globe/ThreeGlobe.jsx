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
import { OrbitControls, Stars, Line } from '@react-three/drei'
import * as THREE from 'three'
import PropTypes from 'prop-types'

import LoadingSphere from './LoadingSphere.jsx'
import SatelliteTooltip from './SatelliteTooltip.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Radius of the Earth sphere in Three.js units. */
const R = 6.5

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
function EarthMesh() {
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

  // Rotate Earth slowly
  useFrame((_, delta) => {
    if (earthRef.current) {
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

    // Add a console.log to verify colors are being set (first 5 satellite types and colors)
    const logData = visible.slice(0, 5).map((sat) => {
      const typeKey = (sat.object_type || sat.type || 'unknown').toLowerCase()
      let colorStr = '#888888'
      if (typeKey === 'payload') colorStr = '#00ff9d'
      else if (typeKey === 'debris') colorStr = '#ff4d4d'
      else if (typeKey === 'rocket body') colorStr = '#ff9d00'
      return { type: typeKey, color: colorStr }
    })
    console.log('Satellite colors (first 5):', logData)
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

// ── Inner scene (runs inside Canvas context) ──────────────────────────────────

/**
 * @param {Object} props
 * @param {Array}       props.satellites
 * @param {Array}       props.positions
 * @param {string|null} props.selectedNoradId
 * @param {Function}    props.onSelect
 * @param {Object}      props.controlsRef
 */
function GlobeScene({ satellites, positions, selectedNoradId, onSelect, controlsRef }) {
  const [hoveredSat, setHoveredSat] = useState(/** @type {Object|null} */ (null))
  const [followActive, setFollowActive] = useState(false)
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(0.5)

  // Listen to camera follow and demo events
  useEffect(() => {
    const handleFollow = () => {
      setFollowActive((prev) => !prev)
    }
    const handleDemoSelect = () => {
      // Auto-focus and follow in demo mode
      setFollowActive(true)
    }
    const handleAutoRotate = (e) => {
      const { enabled, speed } = e.detail ?? {}
      setAutoRotateSpeed(enabled ? speed : 0.5)
    }

    window.addEventListener('ow:follow-satellite', handleFollow)
    window.addEventListener('ow:demo-select-satellite', handleDemoSelect)
    window.addEventListener('ow:demo-auto-rotate', handleAutoRotate)

    return () => {
      window.removeEventListener('ow:follow-satellite', handleFollow)
      window.removeEventListener('ow:demo-select-satellite', handleDemoSelect)
      window.removeEventListener('ow:demo-auto-rotate', handleAutoRotate)
    }
  }, [])

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
  useFrame(() => {
    if (followActive && selectedSatCartesian && controlsRef.current) {
      const [x, y, z] = selectedSatCartesian
      const targetVec = new THREE.Vector3(x, y, z)
      // Smoothly interpolate the controls target to the satellite position
      controlsRef.current.target.lerp(targetVec, 0.1)
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
        autoRotate={!followActive}
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
function ThreeGlobe({ satellites, positions, selectedNoradId, onSelect, controlsRef }) {
  const internalRef = useRef(null)
  const resolvedRef = controlsRef ?? internalRef

  return (
    <Canvas
      camera={{ position: [0, 0, 20], fov: 50 }}
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
