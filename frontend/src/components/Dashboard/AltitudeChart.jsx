/**
 * @fileoverview AltitudeChart.jsx — Renders satellite distribution across altitude bands.
 */

import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

/**
 * Custom tooltip component for the Recharts BarChart.
 *
 * @param {Object} props
 * @param {boolean} props.active
 * @param {Array} props.payload
 * @returns {JSX.Element | null}
 */
function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div
        style={{
          background: 'rgba(15, 15, 26, 0.95)',
          border: '1px solid var(--space-border-bright, #2a2a4a)',
          borderRadius: 'var(--radius-sm, 6px)',
          padding: '8px 12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <p style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--space-text, #e8e8f0)', marginBottom: '4px' }}>
          {data.name}
        </p>
        <p style={{ fontSize: '0.75rem', color: data.color, fontWeight: 700 }}>
          Count: {payload[0].value}
        </p>
      </div>
    )
  }
  return null
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
}

/**
 * AltitudeChart component.
 *
 * @param {{ satellites: Array }} props
 * @returns {JSX.Element}
 */
export function AltitudeChart({ satellites }) {
  // Memoize counts to avoid recalculating on every render
  const chartData = useMemo(() => {
    let band1 = 0 // 0-500km
    let band2 = 0 // 500-1000km
    let band3 = 0 // 1000-2000km
    let band4 = 0 // 2000km+

    satellites.forEach((sat) => {
      const alt = sat.altitude_km ?? sat.alt ?? sat.altitude ?? 0
      if (alt <= 500) {
        band1++
      } else if (alt <= 1000) {
        band2++
      } else if (alt <= 2000) {
        band3++
      } else {
        band4++
      }
    })

    return [
      { name: '0-500km', count: band1, color: '#00d4ff' },
      { name: '500-1000km', count: band2, color: '#00ff9d' },
      { name: '1000-2000km', count: band3, color: '#ff9d00' },
      { name: '2000km+', count: band4, color: '#a855f7' },
    ]
  }, [satellites])

  const isEmpty = useMemo(() => {
    return chartData.every((item) => item.count === 0)
  }, [chartData])

  if (isEmpty) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 250,
          color: '#8a8ab0',
          background: 'transparent',
          fontSize: '0.875rem',
          border: '1px dashed var(--space-border, #1a1a2e)',
          borderRadius: 'var(--radius-lg, 16px)',
        }}
      >
        No data available
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 250, background: 'transparent' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <XAxis
            dataKey="name"
            stroke="#1a1a2e"
            tick={{ fill: '#8a8ab0', fontSize: 11 }}
            axisLine={{ stroke: '#1a1a2e' }}
            tickLine={false}
          />
          <YAxis
            stroke="#1a1a2e"
            tick={{ fill: '#8a8ab0', fontSize: 11 }}
            axisLine={{ stroke: '#1a1a2e' }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

AltitudeChart.propTypes = {
  /** Array of satellite position or metadata objects */
  satellites: PropTypes.arrayOf(PropTypes.object).isRequired,
}

export default AltitudeChart
