import { useState, useEffect, useCallback, useRef } from 'react'
import PropTypes from 'prop-types'
import { useAppContext } from '../../context/AppContext.jsx'
import { X, ShieldAlert, CheckCircle, AlertTriangle, Info, ZoomIn, RefreshCw } from 'lucide-react'

const LAUNCH_SITES = {
  'Cape Canaveral': { lat: 28.5383, lon: -80.6489, desc: 'US Space Force Station' },
  'Baikonur': { lat: 45.9650, lon: 63.3050, desc: 'Kazakhstan Cosmodrome' },
  'Kourou': { lat: 5.1597, lon: -52.6502, desc: 'Guiana Space Centre' },
  'Vandenberg': { lat: 34.7420, lon: -120.5724, desc: 'US Space Force Base' }
}

export default function LaunchSimulatorPanel({ satellites }) {
  const {
    simOpen,
    setSimOpen,
    simParams,
    setSimParams,
    simActive,
    setSimActive,
    simResult,
    setSimResult,
    simLaunched,
    setSimLaunched,
    positions: livePositions,
  } = useAppContext()

  const workerRef = useRef(null)

  // Sync inputs locally
  const [name, setName] = useState(simParams.name)
  const [launchSite, setLaunchSite] = useState(simParams.launchSite)
  const [altitudeKm, setAltitudeKm] = useState(simParams.altitudeKm)
  const [inclination, setInclination] = useState(simParams.inclination)
  const [eccentricity, setEccentricity] = useState(simParams.eccentricity)
  const [raan, setRaan] = useState(simParams.raan)
  const [payloadMass, setPayloadMass] = useState(simParams.payloadMass)
  const [durationYears, setDurationYears] = useState(simParams.durationYears)
  const [deorbitStrategy, setDeorbitStrategy] = useState(simParams.deorbitStrategy)

  // Calculations derived from inputs
  const siteLat = LAUNCH_SITES[launchSite].lat
  const directMinInc = siteLat
  
  // Velocity at target altitude: v = sqrt(GM / (R_E + h))
  const GM = 398600.4418
  const RE = 6378.137
  const r = RE + Number(altitudeKm)
  const orbitalSpeedKms = Math.sqrt(GM / r)
  
  // If target inclination is less than launch site latitude, we need a plane change
  let requiredDeltaV = 0
  const isPlaneChangeRequired = Number(inclination) < directMinInc
  if (isPlaneChangeRequired) {
    const deltaI = ((directMinInc - Number(inclination)) * Math.PI) / 180
    // dV = 2 * v * sin(dI / 2)
    requiredDeltaV = 2 * orbitalSpeedKms * Math.sin(deltaI / 2) * 1000 // in m/s
  }

  // Update simulation parameters globally in context as user types
  useEffect(() => {
    setSimParams({
      name,
      launchSite,
      altitudeKm: Number(altitudeKm),
      inclination: Number(inclination),
      eccentricity: Number(eccentricity),
      raan: raan === '' ? '' : Number(raan),
      payloadMass: Number(payloadMass),
      durationYears: Number(durationYears),
      deorbitStrategy
    })
  }, [name, launchSite, altitudeKm, inclination, eccentricity, raan, payloadMass, durationYears, deorbitStrategy, setSimParams])

  // Handle site change -> update inclination automatically to avoid plane change deltaV if possible
  const handleSiteChange = (site) => {
    setLaunchSite(site)
    const newLat = LAUNCH_SITES[site].lat
    setInclination(Math.max(newLat, Number(inclination)))
  }

  // Run SGP4 simulation inside Web Worker
  // Run SGP4 simulation inside Web Worker
  const runValidation = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    setSimActive(true)

    // Instantiate worker
    const worker = new Worker(
      new URL('../../workers/propagation.worker.js', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e) => {
      setSimActive(false)
      if (e.data.error) {
        console.error("Worker error:", e.data.error)
      } else {
        setSimResult(e.data)
      }
      worker.terminate()
      if (workerRef.current === worker) {
        workerRef.current = null
      }
    }

    // Post data to worker
    worker.postMessage({
      proposedOrbit: {
        altitudeKm,
        inclination,
        eccentricity,
        raan: raan === '' ? null : raan,
      },
      catalogSatellites: satellites || []
    })
  }, [altitudeKm, inclination, eccentricity, raan, satellites, setSimActive, setSimResult])

  // Trigger validation automatically with debounce on parameter changes
  useEffect(() => {
    if (!simOpen || !satellites || satellites.length === 0) return

    // Reset launch state on parameter change, so it returns to design/ghost phase
    setSimLaunched(false)

    const timer = setTimeout(() => {
      runValidation()
    }, 200)

    return () => {
      clearTimeout(timer)
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [altitudeKm, inclination, eccentricity, raan, satellites, simOpen, runValidation, setSimLaunched])

  // Apply suggestion parameters
  const applySuggestion = (alt, inc) => {
    setAltitudeKm(alt)
    setInclination(inc)
    setSimResult(null)
    // Run simulation automatically after state updates
    setTimeout(() => {
      // Access values from latest closures
      setSimParams(prev => ({
        ...prev,
        altitudeKm: alt,
        inclination: inc
      }))
    }, 50)
  }

  // Zoom view to conflict position
  const handleZoomToConflict = () => {
    const pos = simResult?.conflictPos || simResult?.proposedPos
    if (!pos) return
    
    // Map standard ECI to Three.js coordinates
    // Three.js: X = x_eci, Y = z_eci, Z = y_eci
    const scale = 6.5 / 6378.137
    const threePos = [pos.x * scale, pos.z * scale, pos.y * scale]
    
    window.dispatchEvent(
      new CustomEvent('ow:zoom-to-conflict', {
        detail: { position: threePos }
      })
    )
  }

  if (!simOpen) return null

  return (
    <div
      id="launch-simulator-panel"
      style={{
        position: 'absolute',
        left: 24,
        top: 24,
        bottom: 24,
        width: 330,
        background: 'rgba(8, 8, 14, 0.90)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(0,212,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        pointerEvents: 'auto',
        overflow: 'hidden',
        animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--space-border)',
          background: 'rgba(255,255,255,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🚀</span>
          <div>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e8e8f0', margin: 0, letterSpacing: '0.05em' }}>LAUNCH SIMULATOR</h2>
            <span style={{ fontSize: '0.65rem', color: 'var(--space-text-muted)' }}>Mission Risk Assessment</span>
          </div>
        </div>
        <button
          onClick={() => setSimOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--space-text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            borderRadius: '50%',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <X size={18} />
        </button>
      </div>

      {/* Panel Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Name & Launch Site */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--space-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Satellite Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--space-border)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                color: '#e8e8f0',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--space-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Launch Site</label>
            <select
              value={launchSite}
              onChange={(e) => handleSiteChange(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(10,10,18,0.95)',
                border: '1px solid var(--space-border)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                color: '#e8e8f0',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {Object.keys(LAUNCH_SITES).map((site) => (
                <option key={site} value={site}>
                  {site} ({LAUNCH_SITES[site].lat.toFixed(1)}°N)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Orbit configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', borderTop: '1px solid var(--space-border)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--space-cyan)', letterSpacing: '0.07em', margin: 0 }}>Target Parameters</h3>

          {/* Altitude */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--space-text-muted)' }}>Target Altitude</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--space-cyan)' }}>{altitudeKm} km</span>
            </div>
            <input
              type="range"
              min="200"
              max="2000"
              step="10"
              value={altitudeKm}
              onChange={(e) => setAltitudeKm(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--space-cyan)', cursor: 'pointer' }}
            />
          </div>

          {/* Inclination */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--space-text-muted)' }}>Inclination</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--space-cyan)' }}>{inclination}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="98"
              step="0.5"
              value={inclination}
              onChange={(e) => setInclination(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--space-cyan)', cursor: 'pointer' }}
            />
            {isPlaneChangeRequired && (
              <div style={{ display: 'flex', gap: '0.35rem', color: '#ffbb33', fontSize: '0.65rem', marginTop: 4, lineHeight: 1.3 }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Inclination lower than launch site latitude ({directMinInc.toFixed(1)}°). Plane change requires ~{Math.round(requiredDeltaV)} m/s Delta-V.</span>
              </div>
            )}
          </div>

          {/* Eccentricity */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--space-text-muted)' }}>Eccentricity</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--space-cyan)' }}>{eccentricity}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.1"
              step="0.001"
              value={eccentricity}
              onChange={(e) => setEccentricity(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--space-cyan)', cursor: 'pointer' }}
            />
          </div>

          {/* RAAN/LTAN */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--space-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>RAAN / LTAN (Optional)</label>
            <input
              type="number"
              placeholder="Auto-Optimized (Optimal LTAN)"
              value={raan}
              min="0"
              max="360"
              onChange={(e) => setRaan(e.target.value === '' ? '' : Number(e.target.value))}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--space-border)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                color: '#e8e8f0',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Mass & Duration */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--space-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Payload Mass (kg)</label>
              <input
                type="number"
                value={payloadMass}
                onChange={(e) => setPayloadMass(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--space-border)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  color: '#e8e8f0',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--space-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Duration (Years)</label>
              <input
                type="number"
                min="1"
                max="15"
                value={durationYears}
                onChange={(e) => setDurationYears(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--space-border)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  color: '#e8e8f0',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Deorbit strategy */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--space-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>De-orbit Strategy</label>
            <select
              value={deorbitStrategy}
              onChange={(e) => setDeorbitStrategy(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(10,10,18,0.95)',
                border: '1px solid var(--space-border)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                color: '#e8e8f0',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="Active">Active (Controlled Re-entry)</option>
              <option value="Passive">Passive (Atmospheric Decay)</option>
            </select>
          </div>
        </div>

        {/* Dynamic Launch constraints display */}
        <div
          style={{
            background: 'rgba(0, 212, 255, 0.03)',
            border: '1px solid rgba(0, 212, 255, 0.1)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            fontSize: '0.7rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--space-text-muted)' }}>Direct Inclination:</span>
            <span style={{ color: '#e8e8f0', fontWeight: 600 }}>{directMinInc.toFixed(1)}° to 98°</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--space-text-muted)' }}>Plane Change Delta-V:</span>
            <span style={{ color: isPlaneChangeRequired ? '#ffbb33' : '#00ff9d', fontWeight: 600 }}>
              {isPlaneChangeRequired ? `${Math.round(requiredDeltaV)} m/s` : '0 m/s (Direct)'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--space-text-muted)' }}>Optimal Launch Window:</span>
            <span style={{ color: '#00d4ff', fontWeight: 600 }}>RAAN ~{Math.round(360 - LAUNCH_SITES[launchSite].lon)}°</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setSimLaunched(!simLaunched)}
          disabled={simActive}
          style={{
            width: '100%',
            background: simActive 
              ? 'rgba(0, 212, 255, 0.1)' 
              : simLaunched
              ? 'linear-gradient(135deg, #ff4466, #ff88aa)'
              : 'linear-gradient(135deg, #00d4ff, #00ff9d)',
            color: simActive ? 'var(--space-cyan)' : '#000000',
            fontWeight: 700,
            fontSize: '0.85rem',
            border: simActive ? '1px solid rgba(0, 212, 255, 0.2)' : 'none',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            cursor: simActive ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: simActive ? 'none' : '0 4px 15px rgba(0,212,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {simActive ? (
            <>
              <RefreshCw size={16} className="spin" />
              <span>Analyzing Catalog Orbits...</span>
            </>
          ) : simLaunched ? (
            <span>💥 Reset Simulation</span>
          ) : (
            <span>🚀 Launch Satellite</span>
          )}
        </button>

        {/* Simulation results display */}
        {simResult && (
          <div
            style={{
              borderTop: '1px solid var(--space-border)',
              paddingTop: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              animation: 'fadeIn 0.3s ease forwards'
            }}
          >
            {/* GO / NO-GO Banner */}
            <div
              style={{
                borderRadius: '10px',
                padding: '0.875rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                border: '1px solid',
                background:
                  simResult.status === 'APPROVED'
                    ? 'rgba(0,255,157,0.06)'
                    : simResult.status === 'WARNING'
                    ? 'rgba(255,187,51,0.06)'
                    : 'rgba(255,68,102,0.06)',
                borderColor:
                  simResult.status === 'APPROVED'
                    ? 'rgba(0,255,157,0.3)'
                    : simResult.status === 'WARNING'
                    ? 'rgba(255,187,51,0.3)'
                    : 'rgba(255,68,102,0.3)',
                boxShadow:
                  simResult.status === 'APPROVED'
                    ? '0 0 15px rgba(0,255,157,0.1)'
                    : simResult.status === 'WARNING'
                    ? '0 0 15px rgba(255,187,51,0.1)'
                    : '0 0 15px rgba(255,68,102,0.1)',
              }}
            >
              {simResult.status === 'APPROVED' ? (
                <>
                  <CheckCircle size={22} color="#00ff9d" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00ff9d' }}>GO — ORBIT APPROVED</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--space-text-muted)', lineHeight: 1.2 }}>No critical conjunction conflicts detected in catalog.</div>
                  </div>
                </>
              ) : simResult.status === 'WARNING' ? (
                <>
                  <AlertTriangle size={22} color="#ffbb33" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffbb33' }}>WARN — HIGH CONJUNCTION</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--space-text-muted)', lineHeight: 1.2 }}>Close approaches detected. Monitor orbital parameters.</div>
                  </div>
                </>
              ) : (
                <>
                  <ShieldAlert size={22} color="#ff4466" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ff4466' }}>NO-GO — ORBIT REJECTED</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--space-text-muted)', lineHeight: 1.2 }}>Critical collision risk detected with tracked catalog object.</div>
                  </div>
                </>
              )}
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--space-border)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.58rem', color: 'var(--space-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Min Separation</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: simResult.closestApproachKm < 10.0 ? '#ff4466' : '#e8e8f0', fontFamily: 'monospace' }}>
                  {simResult.closestApproachKm ? `${simResult.closestApproachKm.toFixed(2)} km` : '—'}
                </div>
              </div>

              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--space-border)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.58rem', color: 'var(--space-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Collision Prob (Pc)</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: simResult.probability > 1e-4 ? '#ff4466' : '#e8e8f0', fontFamily: 'monospace' }}>
                  {simResult.probability ? simResult.probability.toExponential(2) : '0.00'}
                </div>
              </div>
            </div>

            {/* Conflicting Object & Zoom to Conflict */}
            {simResult.conflictingObject && (
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--space-border)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.58rem', color: 'var(--space-text-muted)', textTransform: 'uppercase' }}>Conflicting Object</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e8e8f0' }}>{simResult.conflictingObject.name}</span>
                    <span style={{ fontSize: '0.6rem', padding: '0.05rem 0.25rem', borderRadius: '4px', background: 'rgba(255,68,102,0.1)', color: '#ff4466', border: '1px solid rgba(255,68,102,0.2)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {simResult.conflictingObject.object_type}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--space-text-muted)' }}>NORAD: #{simResult.conflictingObject.norad_id} | TLE Age: {Math.round(simResult.conflictingObject.ageDays)}d</span>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', color: 'var(--space-cyan)', fontSize: '0.62rem', alignItems: 'center', margin: '0.2rem 0' }}>
                  <Info size={12} style={{ flexShrink: 0 }} />
                  <span>
                    Confidence: {simResult.conflictingObject.ageDays > 30 ? 'LOW' : simResult.conflictingObject.ageDays > 14 ? 'MEDIUM' : 'HIGH'}
                  </span>
                </div>

                <button
                  onClick={handleZoomToConflict}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 212, 255, 0.08)',
                    color: 'var(--space-cyan)',
                    border: '1px solid rgba(0, 212, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)'
                    e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)'
                    e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.2)'
                  }}
                >
                  <ZoomIn size={14} />
                  <span>Zoom to Conflict Coordinate</span>
                </button>
              </div>
            )}

            {/* Alternative Suggestions */}
            {simResult.suggestions && simResult.suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--space-green)', letterSpacing: '0.06em', margin: 0 }}>Alternative Suggestions</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {simResult.suggestions.slice(0, 3).map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => applySuggestion(sug.altitudeKm, sug.inclination)}
                      style={{
                        textAlign: 'left',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--space-border)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        color: '#e8e8f0',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 255, 157, 0.05)'
                        e.currentTarget.style.borderColor = 'rgba(0, 255, 157, 0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                        e.currentTarget.style.borderColor = 'var(--space-border)'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--space-green)' }}>{sug.label}</span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--space-text-muted)' }}>
                        Plane Change Delta-V cost: ~{sug.deltaV} m/s | Safe separation: {sug.safetyMargin.toFixed(1)} km
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

LaunchSimulatorPanel.propTypes = {
  satellites: PropTypes.array,
}

LaunchSimulatorPanel.defaultProps = {
  satellites: [],
}
