/**
 * @fileoverview LoadingSphere.jsx — R3F fallback shown inside <Suspense> while
 * the main globe and satellite data are loading.
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'

// ── LoadingSphere ─────────────────────────────────────────────────────────────

/**
 * A spinning wireframe sphere rendered in the Three.js scene while the main
 * ThreeGlobe component is suspended.
 *
 * @returns {JSX.Element}
 */
function LoadingSphere() {
  const meshRef = useRef(/** @type {import('three').Mesh|null} */ (null))

  // Slowly spin the wireframe
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4
      meshRef.current.rotation.x += delta * 0.15
    }
  })

  return (
    <group>
      {/* Outer spinning wireframe globe */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[5, 24, 24]} />
        <meshBasicMaterial color="#00d4ff" wireframe opacity={0.35} transparent />
      </mesh>

      {/* Inner pulsing solid sphere */}
      <mesh>
        <sphereGeometry args={[4.8, 32, 32]} />
        <meshBasicMaterial color="#050508" opacity={0.8} transparent />
      </mesh>

      {/* HTML overlay text */}
      <Html center>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid transparent',
              borderTop: '3px solid #00d4ff',
              borderRadius: '50%',
              animation: 'spin 0.9s linear infinite',
            }}
          />
          <span
            style={{
              color: '#00d4ff',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.85,
              whiteSpace: 'nowrap',
            }}
          >
            Loading Orbital Data...
          </span>
        </div>

        {/* Scoped keyframe injected once */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Html>
    </group>
  )
}

export default LoadingSphere
