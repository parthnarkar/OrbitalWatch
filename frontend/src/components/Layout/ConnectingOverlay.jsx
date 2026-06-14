import PropTypes from 'prop-types'
import { useMemo } from 'react'

/**
 * A premium, responsive connecting overlay shown while the backend is waking up.
 * Contains modern CSS animations, a custom segmented progress bar, and a
 * high-tech terminal output detailing simulated connection steps.
 *
 * @param {{ wakeAttempt: number }} props
 * @returns {JSX.Element}
 */
function ConnectingOverlay({ wakeAttempt }) {
  // Generate simulated telemetry logs based on the current attempt
  const telemetryLogs = useMemo(() => {
    const logs = [
      { id: '1', text: '[OK] Client shell initialised.', minAttempt: 0 },
      { id: '2', text: '[OK] Resolving server telemetry endpoints...', minAttempt: 0 },
      { id: '3', text: '[OK] Target host verified: Render Cloud Node', minAttempt: 1 },
      { id: '4', text: '[SYS] Sending wake signal (HTTP GET /ping)...', minAttempt: 1 },
    ]

    if (wakeAttempt >= 2) {
      logs.push({ id: '5', text: '[INFO] Server spinner detected. Spin-up mode: ON', minAttempt: 2 })
    }
    if (wakeAttempt >= 4) {
      logs.push({ id: '6', text: '[SYS] Awaiting instance provisioning...', minAttempt: 4 })
    }
    if (wakeAttempt >= 6) {
      logs.push({ id: '7', text: '[SYS] Initialising WebSocket gateway connection...', minAttempt: 6 })
    }
    if (wakeAttempt >= 8) {
      logs.push({ id: '8', text: '[INFO] Database container handshaking...', minAttempt: 8 })
    }
    if (wakeAttempt >= 12) {
      logs.push({ id: '9', text: '[SYS] Allocating Redis pub/sub scheduler memory...', minAttempt: 12 })
    }
    if (wakeAttempt >= 16) {
      logs.push({ id: '10', text: '[WARN] Handshake threshold exceeded, retrying telemetry...', minAttempt: 16 })
    }

    // Return the last 5 logs for display
    return logs.slice(-5)
  }, [wakeAttempt])

  // Active progress percentage
  const progressPercent = Math.min((wakeAttempt / 20) * 100, 100)

  return (
    <div className="connecting-overlay">
      <div className="connecting-overlay-bg" />
      <div className="connecting-overlay-grid" />

      <div className="connecting-content">
        {/* ── Outer Satellite Telemetry Spinner ── */}
        <div className="spinner-container">
          <svg className="telemetry-svg" viewBox="0 0 200 200">
            {/* Outer Orbit */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="rgba(0, 212, 255, 0.12)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              className="orbit-outer"
            />
            {/* Inner Orbit */}
            <circle
              cx="100"
              cy="100"
              r="60"
              fill="none"
              stroke="rgba(0, 255, 157, 0.18)"
              strokeWidth="1"
              strokeDasharray="12 4 4 4"
              className="orbit-inner"
            />
            {/* Satellite A */}
            <circle cx="100" cy="20" r="4" fill="#00d4ff" className="satellite-node-a">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 100 100"
                to="360 100 100"
                dur="7s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Satellite B */}
            <circle cx="100" cy="40" r="3" fill="#00ff9d" className="satellite-node-b">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="360 100 100"
                to="0 100 100"
                dur="4.5s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Earth Core Pulse */}
            <circle cx="100" cy="100" r="28" fill="url(#earthGrad)" className="earth-core" />
            <circle cx="100" cy="100" r="28" fill="none" stroke="#00d4ff" strokeWidth="1" className="earth-core-pulse" />
            
            <defs>
              <radialGradient id="earthGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#081028" />
                <stop offset="70%" stopColor="#0b2046" />
                <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.8" />
              </radialGradient>
            </defs>
          </svg>
          <div className="spinner-scanline" />
        </div>

        {/* ── Status Header ── */}
        <div className="status-header">
          <h1 className="status-title">OrbitalWatch System Initialisation</h1>
          <div className="status-subtitle">
            <span className="live-badge">
              <span className="live-dot" /> TELEMETRY PENDING
            </span>
          </div>
        </div>

        {/* ── Segmented Progress Bar ── */}
        <div className="progress-section">
          <div className="progress-ticks">
            {Array.from({ length: 20 }).map((_, idx) => {
              const active = idx < wakeAttempt || (wakeAttempt === 0 && idx === 0)
              return (
                <div
                  key={idx}
                  className={`progress-tick ${active ? 'active' : ''}`}
                  style={{
                    animationDelay: `${idx * 40}ms`
                  }}
                />
              )
            })}
          </div>
          <div className="progress-metrics">
            <span className="progress-percent">
              {wakeAttempt > 0 ? `${Math.round(progressPercent)}%` : 'CONNECTING'}
            </span>
            <span className="progress-attempt">
              {wakeAttempt > 0 ? `Attempt ${wakeAttempt} of 20` : 'Establishing Handshake...'}
            </span>
          </div>
        </div>

        {/* ── Sci-Fi Diagnostics Console ── */}
        <div className="diagnostics-panel">
          <div className="diagnostics-header">
            <div className="dots">
              <span className="dot dot-r" />
              <span className="dot dot-y" />
              <span className="dot dot-g" />
            </div>
            <span className="diag-title">SYSTEM DIAGNOSTICS CONSOLE</span>
          </div>
          <div className="diagnostics-body">
            {telemetryLogs.map((log) => (
              <div key={log.id} className="diag-line">
                <span className="diag-timestamp">[{new Date().toLocaleTimeString()}]</span>{' '}
                <span className="diag-text">{log.text}</span>
              </div>
            ))}
            <div className="diag-line cursor-line">
              <span className="diag-timestamp">[{new Date().toLocaleTimeString()}]</span>{' '}
              <span className="diag-text pulse-text">Awaiting next telemetry frame...</span>
              <span className="diag-cursor">_</span>
            </div>
          </div>
        </div>

        {/* ── Footer Warning ── */}
        <div className="warning-footer">
          <span className="info-icon">ℹ</span>
          <p>
            This application uses a spin-down cloud hosting instance. Wake-up procedure takes up to 60 seconds depending on database allocation. Telemetry logs will automatically refresh.
          </p>
        </div>
      </div>

      {/* Styled JSX specifically for the loading overlay to keep everything self-contained and modular */}
      <style>{`
        .connecting-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #040408;
          color: #e8e8f0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
          padding: 1.5rem;
        }

        .connecting-overlay-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(14, 20, 56, 0.75) 0%, rgba(5, 5, 8, 1) 100%);
          z-index: 1;
        }

        .connecting-overlay-grid {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          background-position: center;
          mask-image: radial-gradient(circle at center, black 40%, transparent 90%);
          -webkit-mask-image: radial-gradient(circle at center, black 40%, transparent 90%);
          z-index: 2;
        }

        .connecting-content {
          position: relative;
          z-index: 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 500px;
          width: 100%;
          gap: 1.75rem;
          text-align: center;
        }

        /* ── Spinner ── */
        .spinner-container {
          position: relative;
          width: 160px;
          height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .telemetry-svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.25));
        }

        .orbit-outer {
          transform-origin: center;
          animation: spin-clockwise 20s linear infinite;
        }

        .orbit-inner {
          transform-origin: center;
          animation: spin-counter-clockwise 14s linear infinite;
        }

        .earth-core {
          filter: drop-shadow(0 0 16px rgba(0, 212, 255, 0.6));
        }

        .earth-core-pulse {
          transform-origin: center;
          animation: pulse-ring-glow 3s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }

        .spinner-scanline {
          position: absolute;
          width: 140px;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.5), transparent);
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.8);
          animation: scan-vertical 4s ease-in-out infinite;
          pointer-events: none;
        }

        /* ── Status Header ── */
        .status-header {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .status-title {
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin: 0;
          background: linear-gradient(135deg, #e8e8f0 30%, #a8a8cf 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background: rgba(0, 212, 255, 0.08);
          border: 1px solid rgba(0, 212, 255, 0.25);
          color: #00d4ff;
          padding: 0.35rem 0.85rem;
          border-radius: 999px;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          box-shadow: 0 0 12px rgba(0, 212, 255, 0.1);
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #00d4ff;
          box-shadow: 0 0 8px #00d4ff;
          animation: flash-dot 1.2s infinite;
        }

        /* ── Progress Section ── */
        .progress-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .progress-ticks {
          display: flex;
          gap: 4px;
          width: 100%;
          justify-content: space-between;
        }

        .progress-tick {
          flex: 1;
          height: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          transition: all 400ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .progress-tick.active {
          background: #00ff9d;
          border-color: #00ff9d;
          box-shadow: 0 0 10px rgba(0, 255, 157, 0.5);
          transform: scaleY(1.15);
        }

        .progress-metrics {
          display: flex;
          justify-content: space-between;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.75rem;
          color: #8888aa;
          padding: 0 2px;
        }

        .progress-percent {
          color: #00ff9d;
          font-weight: 700;
        }

        .progress-attempt {
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        /* ── Diagnostics Panel ── */
        .diagnostics-panel {
          width: 100%;
          background: rgba(10, 10, 18, 0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          overflow: hidden;
          text-align: left;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .diagnostics-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.875rem;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .dots {
          display: flex;
          gap: 5px;
        }

        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .dot-r { background: #ff5f56; }
        .dot-y { background: #ffbd2e; }
        .dot-g { background: #27c93f; }

        .diag-title {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.625rem;
          font-weight: 700;
          color: #555577;
          letter-spacing: 0.08em;
        }

        .diagnostics-body {
          padding: 0.875rem;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.68rem;
          line-height: 1.5;
          color: #8888aa;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          min-height: 125px;
          max-height: 160px;
          overflow-y: auto;
        }

        .diag-line {
          animation: console-fade-in 0.3s ease forwards;
        }

        .diag-timestamp {
          color: #3f3f66;
        }

        .diag-text {
          color: #a8a8cf;
        }

        .diag-cursor {
          color: #00ff9d;
          animation: blink 0.9s infinite;
          margin-left: 2px;
          font-weight: 700;
        }

        /* ── Warning Footer ── */
        .warning-footer {
          display: flex;
          gap: 0.65rem;
          align-items: flex-start;
          text-align: left;
          background: rgba(255, 187, 51, 0.02);
          border: 1px solid rgba(255, 187, 51, 0.12);
          padding: 0.65rem 0.85rem;
          border-radius: 6px;
        }

        .info-icon {
          color: #ffbb33;
          font-size: 0.85rem;
          line-height: 1.15;
        }

        .warning-footer p {
          margin: 0;
          font-size: 0.625rem;
          line-height: 1.4;
          color: #8a887a;
        }

        /* ── Animations ── */
        @keyframes spin-clockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes spin-counter-clockwise {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes pulse-ring-glow {
          0% { transform: scale(0.9); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        @keyframes scan-vertical {
          0%, 100% { transform: translateY(-70px); opacity: 0.1; }
          50% { transform: translateY(70px); opacity: 0.8; }
        }

        @keyframes flash-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.8); }
        }

        @keyframes console-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .pulse-text {
          animation: pulse-text-opacity 1.5s ease-in-out infinite;
        }

        @keyframes pulse-text-opacity {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* ── Responsive Scaling ── */
        @media (max-width: 520px) {
          .connecting-content {
            gap: 1.25rem;
          }
          .spinner-container {
            width: 120px;
            height: 120px;
          }
          .status-title {
            font-size: 1.05rem;
          }
          .diagnostics-body {
            font-size: 0.62rem;
            min-height: 105px;
          }
          .progress-ticks {
            gap: 3px;
          }
          .progress-tick {
            height: 6px;
          }
        }
      `}</style>
    </div>
  )
}

ConnectingOverlay.propTypes = {
  wakeAttempt: PropTypes.number.isRequired,
}

export default ConnectingOverlay
