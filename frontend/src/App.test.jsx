import { render } from '@testing-library/react';

import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock the 3D globe component to avoid loading WebGL/Three.js context in tests
vi.mock('./components/Globe/ThreeGlobe', () => ({
  default: () => <div data-testid="mock-three-globe">Mock ThreeGlobe</div>,
}));

// Mock the API services to avoid making real HTTP/axios calls
vi.mock('./services/api', () => ({
  fetchStats: vi.fn().mockReturnValue(new Promise(() => {})),
  fetchConjunctions: vi.fn().mockReturnValue(new Promise(() => {})),
}));

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// Mock the useSatellites hook
vi.mock('./hooks/useSatellites', () => ({
  default: () => ({
    satellites: [],
    loading: false,
    error: null,
  }),
}));

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();
  });
});

