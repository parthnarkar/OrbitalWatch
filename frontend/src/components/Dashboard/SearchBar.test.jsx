import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SearchBar from './SearchBar'
import { AppProvider } from '../../context/AppContext'

// Mock API searchSatellites call
vi.mock('../../services/api', () => ({
  searchSatellites: vi.fn().mockResolvedValue([
    { norad_id: '25544', name: 'ISS (ZARYA)', object_type: 'payload' },
  ]),
}))

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

describe('SearchBar', () => {
  it('renders search input element properly', () => {
    render(
      <AppProvider>
        <SearchBar />
      </AppProvider>
    )
    const input = screen.getByPlaceholderText(/Search satellite/i)
    expect(input).toBeDefined()
  })

  it('displays instant suggestions when typing matching text', async () => {
    render(
      <AppProvider>
        <SearchBar />
      </AppProvider>
    )
    const input = screen.getByPlaceholderText(/Search satellite/i)
    fireEvent.change(input, { target: { value: 'ISS' } })

    const option = await screen.findByText(/ISS \(ZARYA\)/i)
    expect(option).toBeDefined()
  })

  it('triggers onSelect callback when clicking a result', async () => {
    const handleSelect = vi.fn()
    render(
      <AppProvider>
        <SearchBar onSelect={handleSelect} />
      </AppProvider>
    )
    const input = screen.getByPlaceholderText(/Search satellite/i)
    fireEvent.change(input, { target: { value: 'Hubble' } })

    const option = await screen.findByText(/HUBBLE SPACE TELESCOPE/i)
    fireEvent.click(option)

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'HUBBLE SPACE TELESCOPE' })
    )
  })
})
