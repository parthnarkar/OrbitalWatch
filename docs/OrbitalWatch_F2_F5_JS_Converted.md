=== START PROMPT F2 (JSX) ===
Add a 3D Earth globe with real-time satellite visualization to the existing OrbitalWatch React project. Build on top of Prompt F1 (JS version). Use Three.js + React Three Fiber (NOT Cesium.js).

NEW FILES TO CREATE:

1. src/components/Globe/ThreeGlobe.jsx:
   - Component props: { satellites, selectedNoradId, onSelect }
   - Canvas setup:
     * <Canvas camera={{ position: [0, 0, 18], fov: 45 }}>
     * <ambientLight intensity={0.3} />
     * <pointLight position={[10, 10, 10]} intensity={1.5} />
   - Earth sphere:
     * Radius: 5
     * Texture: useLoader(TextureLoader, '/earth-texture.jpg') with fallback color #1a1a2e
     * Rotation: slow auto-rotation (useFrame, delta * 0.05)
     * Atmosphere glow: slightly larger sphere with transparent material, color #00d4ff, opacity 0.1
   - Satellite dots:
     * Convert lat/lon/alt to 3D position using spherical coordinates
     * Use InstancedMesh for 500 dots (performance)
     * Color by type: payload=#00ff9d, debris=#ff4d4d, rocket body=#ff9d00, unknown=#888888
     * Size: 0.08 units (scale with distance)
   - Orbital trails:
     * For selected satellite: draw orbital path using Line component
     * Points: 64 segments, calculate from TLE or approximate circular orbit
     * Color: #00d4ff, opacity 0.4
   - Interaction:
     * OrbitControls: enableDamping, dampingFactor 0.05, minDistance 8, maxDistance 30
     * Raycaster on click: find clicked satellite instance, call onSelect with norad_id
     * Hover: cursor pointer, tooltip with name (HTML overlay using drei's Html component)
   - Stars background:
     * 2000 random points, color white, size 0.05
     * Use Points + BufferGeometry

2. src/components/Globe/SatelliteDot.jsx:
   - Props: { position, color, size, onClick, isSelected }
   - If not using InstancedMesh: individual mesh with SphereGeometry
   - Selected state: scale 1.5x, emissive glow
   - Animation: pulse scale when selected (useFrame)

3. src/components/Globe/OrbitTrail.jsx:
   - Props: { satellite, color }
   - Generate orbital path points from TLE data if available
   - Fallback: circular approximation using altitude to estimate radius
   - Line component from @react-three/drei

4. src/components/Globe/EarthSphere.jsx:
   - Props: { radius, textureUrl }
   - Mesh with SphereGeometry
   - Material: MeshStandardMaterial with map (texture) or color fallback
   - Atmosphere: slightly larger sphere with MeshBasicMaterial, transparent, opacity 0.1, color #00d4ff
   - Cloud layer (optional): transparent texture, slow rotation

5. src/components/Globe/Stars.jsx:
   - Random star field
   - BufferGeometry with positions attribute
   - PointsMaterial, size 0.05, color #ffffff
   - 2000 points, random positions in large sphere (radius 100)

6. src/utils/geo.js:
   - latLonToVector3(lat, lon, alt, earthRadius = 5) → { x, y, z }
   - Convert degrees to radians
   - Spherical to Cartesian: x = (r + alt) * cos(lat) * cos(lon), etc.
   - Altitude scaling: 1 km = 0.001 units (so 400km = 0.4 units above surface)

7. Update src/App.jsx:
   - Import ThreeGlobe
   - Replace placeholder with ThreeGlobe
   - Pass satellites from useWebSocket hook
   - State: selectedNoradId (null initially)
   - onSelect: set selectedNoradId
   - Layout: ThreeGlobe takes full height of main content area

8. Update src/index.css:
   - Add globe-specific styles:
     .globe-container: width 100%, height 100%, position relative
     .globe-tooltip: position absolute, background rgba(0,0,0,0.8), color white, padding 8px 12px, border-radius 4px, pointer-events none, z-index 10
   - Ensure canvas has no outline: canvas { outline: none; }

CRITICAL RULES:
- Use useRef for Three.js objects that need mutation
- Use useFrame for all animations (never setInterval)
- Clean up geometries/materials in useEffect return (dispose)
- OrbitControls must be from @react-three/drei
- The globe must be responsive: use ResizeObserver or Canvas prop style={{ width: '100%', height: '100%' }}
- Performance: use InstancedMesh for dots, not 500 individual meshes. If InstancedMesh is too complex, use <Instances> from drei.
- All satellite positions must update smoothly when new WebSocket data arrives (lerp towards target over 0.5s)
- Earth texture: if NASA Blue Marble fails to load, use a procedural gradient (canvas texture generated in useEffect)
=== END PROMPT F2 ===

=== START PROMPT F3 (JSX) ===
Add dashboard UI components to the existing OrbitalWatch React project. Build on top of Prompts F1 and F2 (JS versions). All components must use the existing hooks/services.

NEW FILES TO CREATE:

1. src/components/Dashboard/SearchBar.jsx:
   - Props: { onSelect }
   - State: query (string), results (array), loading (boolean), showDropdown (boolean), selectedIndex (number)
   - Input: styled search input with magnifying glass icon (Lucide Search)
   - Debounce: use useEffect + setTimeout to call searchSatellites(query) only after 300ms of no typing
   - Dropdown: absolute positioned below input, max-height 300px, scrollable
   - Each result row: name + norad_id + type badge (color-coded)
   - Keyboard navigation: ArrowDown/ArrowUp to navigate, Enter to select, Escape to close
   - On select: call onSelect, clear query, hide dropdown
   - Style: dark background (#0f0f1a), border #1a1a2e, focus ring cyan, rounded-lg
   - Placeholder: "Search satellite (e.g., ISS, Hubble, Starlink-1234)..."

2. src/components/Dashboard/SatelliteInfo.jsx:
   - Props: { noradId }
   - Fetches satellite details via fetchSatellite(noradId) when noradId changes
   - State: satellite (null), loading (boolean), error (null)
   - Shows panel with:
     * Header: Satellite name (large, bold) + NORAD ID (monospace, cyan)
     * Grid of stats:
       - Altitude: {altitude_km} km (with trend arrow if available)
       - Velocity: {velocity_kms} km/s
       - Orbital Period: {period} min
       - Object Type: badge with color
     * TLE Data: collapsible section showing line1/line2 (truncated, copy button)
   - Loading state: skeleton shimmer (3 pulsing bars)
   - Empty state: "Select a satellite on the globe to view details"
   - Style: card with border, padding 20px, background #0f0f1a

3. src/components/Dashboard/AlertPanel.jsx:
   - Props: { conjunctions, onSelect }
   - State: sortField (string), sortDirection ('asc' | 'desc'), filterRisk ('ALL' | 'LOW' | 'MEDIUM' | 'HIGH')
   - Shows a table of active conjunctions:
     * Columns: Risk (badge), Satellites, Approach Time, Miss Distance, Probability
     * Risk badge colors: LOW=#00ff9d, MEDIUM=#ff9d00, HIGH=#ff4d4d
     * Approach Time: formatted as "2h 15m" (relative) + absolute time on hover
     * Miss Distance: {distance} km (2 decimal places)
     * Probability: {(prob * 100).toFixed(2)}%
   - Sorting: click column header to sort (default: risk_level desc, then approach_time asc)
   - Filtering: tabs above table (All, HIGH, MEDIUM, LOW)
   - Empty state: "No conjunctions detected in the next 72 hours"
   - On row click: call onSelect, highlight row with cyan border
   - Style: full-width card, compact table rows, monospace for numbers

4. src/components/Dashboard/AlertDetail.jsx:
   - Props: { conjunction, onClose }
   - State: show3DPreview (boolean)
   - Modal/slide-out panel showing:
     * Header: "Conjunction Alert" + risk badge + close button
     * Two satellite cards side by side (name, NORAD ID, type)
     * Details grid:
       - Closest Approach: {time} (countdown if < 24h)
       - Miss Distance: {distance} km
       - Relative Velocity: calculated field (show placeholder "TBD" if not available)
       - Collision Probability: {(prob * 100).toFixed(3)}%
     * 3D Preview button: triggers camera focus on both satellites (emits event or uses context)
   - Animation: slide in from right, backdrop blur
   - Style: width 400px, background #0a0a12, border-left 3px solid risk color

5. src/components/Dashboard/StatsCards.jsx:
   - Props: { stats }
   - 4 cards in a row:
     * Total Objects: {total} (icon: Globe from Lucide)
     * Debris Count: {debris} (icon: Trash2, color red)
     * Active Alerts: {alerts} (icon: AlertTriangle, color orange if >0)
     * Last Scan: "5m ago" (calculated from last_scan timestamp, auto-updates)
   - Each card: icon + number + label, background #0f0f1a, border #1a1a2e, rounded-xl, padding 16px
   - Hover: border color transitions to cyan

6. Update src/components/Layout/Sidebar.jsx:
   - Add navigation items that toggle views:
     * Dashboard (globe view)
     * Alerts (alert panel full screen)
     * Search (focus search bar)
   - Show active alerts count badge on Alerts nav item
   - Add connection status: green dot if WebSocket connected, red if not

7. Update src/App.jsx:
   - Import all new components
   - Layout: Sidebar + Main Area
   - State: activeView ('globe' | 'alerts')
   - Main Area has two modes:
     * Globe Mode: ThreeGlobe (top 70%) + StatsCards + SatelliteInfo (bottom 30%, side by side)
     * Alert Mode: AlertPanel full width + AlertDetail slide-out
   - Connect SearchBar to globe selection (onSelect sets selectedNoradId in context)
   - Use AppContext for selectedSatellite, showDebrisOnly, activeAlert

CRITICAL RULES:
- All Lucide icons must be imported individually (tree-shaking): import { Search, Globe, AlertTriangle } from 'lucide-react'
- Date formatting: use native Intl.DateTimeFormat or simple toLocaleString. Do NOT install date-fns (keep bundle small).
- Relative time ("5m ago"): write a simple utility function, don't import a library.
- All tables must be responsive: horizontal scroll on mobile, min-width on columns.
- The AlertDetail panel must close when clicking the backdrop or pressing Escape.
- Use React.memo on AlertPanel row items to prevent re-renders when parent updates.
- PropTypes or JSDoc comments required for all component props (since no TypeScript).
=== END PROMPT F3 ===

=== START PROMPT F4 (JSX) ===
Add real-time updates, analytics charts, and filtering to the existing OrbitalWatch React project. Build on top of Prompts F1-F3 (JS versions).

NEW FILES TO CREATE:

1. src/components/Dashboard/AltitudeChart.jsx:
   - Props: { satellites }
   - Uses Recharts (BarChart) to show altitude distribution:
     * X-axis: Altitude bands (0-500km, 500-1000km, 1000-2000km, 2000km+)
     * Y-axis: Count of satellites in each band
     * Colors: 0-500=#00d4ff, 500-1000=#00ff9d, 1000-2000=#ff9d00, 2000+=#a855f7
   - Container: ResponsiveContainer width="100%" height={250}
   - Tooltip: custom dark tooltip with band range and count
   - Empty state: "No data available" centered in chart area
   - Style: chart background transparent, axis lines #1a1a2e, text color #8a8ab0

2. src/components/Dashboard/TypeDistribution.jsx:
   - Props: { satellites }
   - Uses Recharts (PieChart) to show object type breakdown:
     * payload, debris, rocket body, unknown
     * Colors: payload=#00ff9d, debris=#ff4d4d, rocket body=#ff9d00, unknown=#888888
   - Show percentage labels on slices
   - Legend below chart
   - Container: ResponsiveContainer width="100%" height={200}

3. src/components/Dashboard/NotificationToast.jsx:
   - Props: { alert, onDismiss }
   - Fixed position: top-right corner, z-index 50
   - Auto-dismiss after 8 seconds (use setTimeout in useEffect, clear on unmount)
   - Shows: risk badge + "Close approach: {sat1} & {sat2} in {time}" + dismiss button
   - Animation: slide in from right (CSS transform translateX), fade out on dismiss
   - On click: navigates to alert detail (uses AppContext setActiveAlert)
   - Style: background #0f0f1a, border-left 4px solid risk color, shadow-lg, rounded-lg, padding 16px, max-width 400px

4. src/components/Dashboard/FilterBar.jsx:
   - Props: { filters, onChange }
   - Toggle buttons for each object type (active = cyan border + bg)
   - Altitude range: simple min/max number inputs (min=0, max=40000, step=100)
   - "Reset Filters" button to restore defaults
   - Style: horizontal flex wrap, gap 8px, padding 12px, background #0a0a12, rounded-lg

5. Update src/hooks/useWebSocket.js:
   - Add a queue for missed alerts: if a 'new_alert' arrives while user is on globe view, store it in a queue
   - Return: { positions, alerts, connected, pendingAlerts, clearPendingAlerts }
   - Add heartbeat: if no message received for 70 seconds, set connected=false and attempt reconnect

6. Update src/context/AppContext.jsx:
   - Add: filters state (from FilterBar)
   - Add: filteredSatellites computed value (useMemo) that applies filters to positions
   - Filter logic:
     * Type filter: include if satellite.type matches enabled types
     * Altitude filter: include if altitude_km is between min and max
   - Export filters and setFilters in context

7. Update src/App.jsx:
   - Add FilterBar above ThreeGlobe
   - Pass filteredSatellites (from context) to ThreeGlobe instead of raw positions
   - Add NotificationToast container that renders pendingAlerts
   - Add AltitudeChart and TypeDistribution to bottom panel (side by side on desktop, stacked on mobile)
   - Auto-switch to Alerts view when a HIGH risk alert arrives and user is on globe view (optional, add toggle in settings)

8. Create src/components/Dashboard/OrbitalClock.jsx:
   - Shows current UTC time updating every second
   - Format: "2026-06-14 14:32:15 UTC"
   - Style: monospace, cyan color, small text in header
   - Use useEffect + setInterval(1000), clear on unmount

CRITICAL RULES:
- Recharts must be imported carefully to avoid bundle bloat: import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
- WebSocket positions update every 60s. The globe should smoothly interpolate dot positions between updates (optional but impressive). For MVP, snapping to new position is acceptable.
- Filter changes must not trigger WebSocket reconnect.
- Notification toasts must not stack infinitely. Max 3 visible at once, queue the rest.
- All chart data must be memoized (useMemo) to prevent re-renders on every position update.
- PropTypes or JSDoc comments required for all component props.
=== END PROMPT F4 ===

=== START PROMPT F5 (JSX) ===
Polish the existing OrbitalWatch React project for demo and production. Build on top of Prompts F1-F4 (JS versions). The output must build successfully.

NEW FILES & MODIFICATIONS:

1. src/components/Dashboard/DemoMode.jsx:
   - Props: { enabled, onToggle }
   - When enabled:
     * Auto-rotate camera slowly (increase OrbitControls autoRotateSpeed to 2.0)
     * Cycle through satellites every 5 seconds (select next in list)
     * Cycle through alerts every 10 seconds (if any exist)
     * Show "DEMO MODE" badge in top-left corner (pulsing cyan)
   - Toggle button in Header (film icon from Lucide)
   - Store demo mode state in localStorage so it persists across reloads

2. src/components/Layout/KeyboardShortcuts.jsx:
   - Custom hook: useKeyboardShortcuts()
   - Shortcuts:
     * '/' → focus search bar
     * 'a' → switch to Alerts view
     * 'g' → switch to Globe view
     * 'f' → toggle follow selected satellite (if any)
     * 'd' → toggle demo mode
     * 'Escape' → close any modal/panel
   - Use useEffect with window.addEventListener('keydown')
   - Prevent default for handled keys
   - Show a "?" button in header that opens a shortcuts cheat sheet modal

3. src/components/Layout/MobileSheet.jsx:
   - For mobile (< 768px): replace sidebar with bottom sheet
   - Sheet slides up from bottom, shows nav items + stats
   - Globe takes full screen, info panel becomes bottom sheet
   - Use CSS media queries, not JS window width checks (for SSR safety)
   - Touch-friendly: larger tap targets (min 44px)

4. src/components/ErrorBoundary.jsx:
   - Class component extending React.Component
   - State: { hasError: false, error: null, errorInfo: null }
   - Catches errors in 3D globe and UI
   - Fallback UI: "Something went wrong in OrbitalWatch" + error message (monospace, small) + "Reload" button
   - Log error to console
   - Wrap ThreeGlobe and App in separate boundaries

5. Update src/index.css:
   - Add CSS animations:
     * @keyframes pulse-cyan: scale + opacity pulse for demo badge
     * @keyframes slide-in-right: for notification toasts
     * @keyframes fade-in: for modal backdrop
   - Add utility classes: .animate-pulse-cyan, .animate-slide-in, .animate-fade-in
   - Ensure all animations use transform/opacity only (GPU accelerated)
   - Add print styles (hide UI chrome, show only globe for screenshots)

6. Update index.html:
   - Add meta description: "Real-time space situational awareness dashboard tracking 500+ orbiting objects with collision detection."
   - Add OpenGraph tags for social sharing
   - Add theme-color meta: #050508
   - Preconnect to Google Fonts

7. Update vite.config.js:
   - Add build optimizations:
     * rollupOptions: manualChunks for three, recharts, socket.io-client (split vendors)
     * target: 'es2020'
   - Add sourcemap: true for debugging

8. Create .env.production:
   VITE_API_URL=/api
   VITE_WS_URL=/
   (Assumes frontend and backend are on same domain in production)

9. Create vercel.json or netlify.toml (optional deployment configs):
   - SPA fallback: all routes → index.html
   - Proxy /api to backend URL

10. Final build verification:
    - Run "npm run build" and fix ALL errors
    - Common fixes needed:
      * Add missing return statements
      * Fix potential null references (use optional chaining ?.)
      * Ensure all event handlers have proper React event types

11. Create src/utils/helpers.js:
    - formatRelativeTime(date) → "2h ago", "5m ago", "Just now"
    - formatDistance(km) → "0.45 km", "12.3 km"
    - formatVelocity(kms) → "7.66 km/s"
    - getRiskColor(level) → returns hex color
    - getTypeColor(type) → returns hex color
    - All functions must be pure

12. Update README.md (frontend section):
    - Setup: npm install → npm run dev
    - Build: npm run build → dist/ folder
    - Environment variables table
    - Browser support: Chrome, Firefox, Safari (latest 2 versions)

CRITICAL RULES:
- The final build must complete with ZERO Vite warnings.
- Bundle size: if > 2MB, investigate. Three.js is large but acceptable. Use tree-shaking.
- Demo mode must be toggleable and clearly indicated. Do NOT leave it on by default.
- All modals must trap focus (Tab cycles within modal, not page). Use a simple focus trap hook.
- The app must work without WebSocket (graceful degradation to polling). Add a fallback in useWebSocket.
- Test on actual mobile device or Chrome DevTools mobile emulation. Touch targets must be >= 44px.
- PropTypes or JSDoc comments required for all component props and utility functions.
- Use ESLint with recommended React hooks rules to catch missing dependencies.
=== END PROMPT F5 ===

=== ADDITIONAL JS PROJECT CHANGES ===

Since F1 was already done in JS, here are the key differences from TS to keep in mind:

FILE EXTENSIONS:
- All .tsx → .jsx
- All .ts → .js
- vite.config.ts → vite.config.js
- tailwind.config.ts → tailwind.config.js (or keep .js)

PACKAGE.JSON (remove TypeScript devDependencies, add ESLint):
```json
{
  "name": "orbitalwatch-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .js,.jsx"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "axios": "^1.7.0",
    "socket.io-client": "^4.8.0",
    "recharts": "^2.15.0",
    "lucide-react": "^0.460.0",
    "three": "^0.170.0",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^9.0.0",
    "prop-types": "^15.8.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "eslint": "^8.57.0",
    "eslint-plugin-react": "^7.33.0",
    "eslint-plugin-react-hooks": "^4.6.0"
  }
}
```

REMOVE TypeScript FILES:
- tsconfig.json
- tsconfig.app.json
- vite-env.d.ts
- src/types/satellite.ts (move to JSDoc comments or PropTypes)

JS TYPE PATTERNS (instead of TypeScript interfaces):
Use JSDoc comments for documentation:
```javascript
/**
 * @typedef {Object} Satellite
 * @property {string} norad_id
 * @property {string} name
 * @property {'payload'|'debris'|'rocket body'|'unknown'} object_type
 * @property {string} [tle_line1]
 * @property {string} [tle_line2]
 */

/**
 * @typedef {Object} Position
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} altitude_km
 * @property {number} velocity_kms
 */

/**
 * @typedef {Object} SatellitePosition
 * @property {string} norad_id
 * @property {string} name
 * @property {number} lat
 * @property {number} lon
 * @property {number} alt
 * @property {string} type
 */

/**
 * @typedef {Object} Conjunction
 * @property {number} id
 * @property {string} sat1_norad_id
 * @property {string} sat1_name
 * @property {string} sat2_norad_id
 * @property {string} sat2_name
 * @property {string} approach_time
 * @property {number} miss_distance_km
 * @property {'LOW'|'MEDIUM'|'HIGH'} risk_level
 * @property {number} probability
 */

/**
 * @typedef {Object} AlertPayload
 * @property {'satellite_positions'|'new_alert'} event
 * @property {SatellitePosition[]|Conjunction} data
 */
```

PropTypes for runtime validation (optional but recommended):
```javascript
import PropTypes from 'prop-types';

SearchBar.propTypes = {
  onSelect: PropTypes.func.isRequired
};

ThreeGlobe.propTypes = {
  satellites: PropTypes.array.isRequired,
  selectedNoradId: PropTypes.string,
  onSelect: PropTypes.func.isRequired
};
```

CONST ASSERTIONS (JavaScript equivalent):
```javascript
/** @type {const} */
const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

/** @type {const} */
const OBJECT_TYPES = ['payload', 'debris', 'rocket body', 'unknown'];
```

ENVIRONMENT VARIABLES:
In Vite + JS, use import.meta.env the same way:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8000';
```

ESLINT CONFIG (.eslintrc.cjs):
```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '19.0' } },
  plugins: ['react-refresh'],
  rules: {
    'react/jsx-no-target-blank': 'off',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
};
```
