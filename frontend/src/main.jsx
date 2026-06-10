/**
 * @fileoverview Application entry point for OrbitalWatch.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error(
    '[OrbitalWatch] Root element #root not found in the DOM. Check index.html.'
  )
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary label="OrbitalWatch App">
      <App />
    </ErrorBoundary>
  </StrictMode>
)
