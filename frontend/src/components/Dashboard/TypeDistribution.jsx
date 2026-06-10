/**
 * @fileoverview TypeDistribution.jsx — Renders object type distribution using a PieChart.
 */

import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts'

/** Colors mapped by object type (lowercase) */
const COLORS = {
  payload: '#00ff9d',
  debris: '#ff4d4d',
  'rocket body': '#ff9d00',
  unknown: '#888888',
}

const RADIAN = Math.PI / 180

/**
 * Custom label generator to render percentage inside/outside the slices.
 */
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent === 0) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="#000000"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={700}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

/**
 * Custom tooltip component for the PieChart.
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
          padding: '6px 10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <p style={{ fontSize: '0.75rem', color: data.color, fontWeight: 700, textTransform: 'capitalize' }}>
          {data.name}: {payload[0].value}
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
 * TypeDistribution component.
 *
 * @param {{ satellites: Array }} props
 * @returns {JSX.Element}
 */
export function TypeDistribution({ satellites }) {
  const chartData = useMemo(() => {
    let payloadCount = 0
    let debrisCount = 0
    let rocketBodyCount = 0
    let unknownCount = 0

    satellites.forEach((sat) => {
      const type = (sat.type || sat.object_type || 'unknown').toLowerCase()
      if (type === 'payload') {
        payloadCount++
      } else if (type === 'debris') {
        debrisCount++
      } else if (type === 'rocket body' || type === 'rocket_body') {
        rocketBodyCount++
      } else {
        unknownCount++
      }
    })

    return [
      { name: 'payload', value: payloadCount, color: COLORS.payload },
      { name: 'debris', value: debrisCount, color: COLORS.debris },
      { name: 'rocket body', value: rocketBodyCount, color: COLORS['rocket body'] },
      { name: 'unknown', value: unknownCount, color: COLORS.unknown },
    ].filter((item) => item.value > 0) // Only show categories with data
  }, [satellites])

  const isEmpty = useMemo(() => chartData.length === 0, [chartData])

  if (isEmpty) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 200,
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
    <div style={{ width: '100%', height: 200, background: 'transparent' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={55}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={32}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: '11px',
              color: '#8a8ab0',
              paddingTop: '8px',
              textTransform: 'capitalize',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

TypeDistribution.propTypes = {
  /** Array of satellite position or metadata objects */
  satellites: PropTypes.arrayOf(PropTypes.object).isRequired,
}

export default TypeDistribution
