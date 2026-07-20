import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppProvider, useAppContext } from './AppContext'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

function TestComponent() {
  const { activeNav, setActiveNav, selectedSatellite, setSelectedSatellite } = useAppContext()
  return (
    <div>
      <span data-testid="nav-value">{activeNav}</span>
      <span data-testid="sat-name">{selectedSatellite?.name ?? 'none'}</span>
      <button onClick={() => setActiveNav('alerts')}>Set Alerts</button>
      <button onClick={() => setSelectedSatellite({ norad_id: '25544', name: 'ISS' })}>Set ISS</button>
    </div>
  )
}

describe('AppContext', () => {
  it('provides default navigation state and allows state updates', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    )

    expect(screen.getByTestId('nav-value').textContent).toBe('dashboard')
    expect(screen.getByTestId('sat-name').textContent).toBe('none')

    fireEvent.click(screen.getByText('Set Alerts'))
    expect(screen.getByTestId('nav-value').textContent).toBe('alerts')

    fireEvent.click(screen.getByText('Set ISS'))
    expect(screen.getByTestId('sat-name').textContent).toBe('ISS')
  })
})
