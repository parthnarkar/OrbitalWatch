/**
 * @fileoverview OrbitalClock.jsx — Digital clock displaying real-time UTC time.
 */

import { useState, useEffect } from 'react'

/**
 * OrbitalClock component.
 *
 * @returns {JSX.Element}
 */
export function OrbitalClock() {
  const [timeStr, setTimeStr] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const date = new Date()
      const yyyy = date.getUTCFullYear()
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(date.getUTCDate()).padStart(2, '0')
      const hh = String(date.getUTCHours()).padStart(2, '0')
      const min = String(date.getUTCMinutes()).padStart(2, '0')
      const ss = String(date.getUTCSeconds()).padStart(2, '0')
      setTimeStr(`${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC`)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        color: 'var(--space-cyan, #00d4ff)',
        fontSize: '0.8rem',
        fontWeight: 600,
        textShadow: '0 0 8px rgba(0, 212, 255, 0.25)',
        letterSpacing: '0.04em',
        padding: '4px 8px',
        background: 'rgba(0, 212, 255, 0.05)',
        border: '1px solid rgba(0, 212, 255, 0.15)',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {timeStr}
    </div>
  )
}

export default OrbitalClock
