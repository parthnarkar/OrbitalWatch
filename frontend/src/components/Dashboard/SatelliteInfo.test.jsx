import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SatelliteInfo from './SatelliteInfo'

vi.mock('../../services/api', () => ({
  fetchSatellite: vi.fn().mockResolvedValue({
    norad_id: '25544',
    name: 'ISS (ZARYA)',
    object_type: 'payload',
    altitude_km: 418.5,
    velocity_kms: 7.66,
    orbital_period_min: 92.8,
    tle_line1: '1 25544U 98067A   24155.90847222  .00016717  00000+0  30619-3 0  9993',
    tle_line2: '2 25544  51.6416  43.2200 0005617  80.0123  26.4529 15.50000000450000',
  }),
}))

describe('SatelliteInfo', () => {
  it('renders unselected empty state message when noradId is null', () => {
    render(<SatelliteInfo noradId={null} isOpen={true} />)
    expect(screen.getByText(/Select a satellite on the globe/i)).toBeDefined()
  })

  it('fetches and displays satellite information when noradId is provided', async () => {
    render(<SatelliteInfo noradId="25544" isOpen={true} />)
    const nameEl = await screen.findByText(/ISS \(ZARYA\)/i)
    expect(nameEl).toBeDefined()
    expect(screen.getByText(/419 km/i)).toBeDefined()
    expect(screen.getByText(/7.66 km\/s/i)).toBeDefined()
  })
})
