/**
 * @fileoverview ErrorBoundary — catches rendering errors in child components.
 * Use it to wrap ThreeGlobe and other complex UI trees.
 */

import { Component } from 'react'
import PropTypes from 'prop-types'

/**
 * @typedef {Object} ErrorBoundaryState
 * @property {boolean}    hasError
 * @property {Error|null} error
 * @property {React.ErrorInfo|null} errorInfo
 */

class ErrorBoundary extends Component {
  /** @param {{ children: import('react').ReactNode, label?: string }} props */
  constructor(props) {
    super(props)
    /** @type {ErrorBoundaryState} */
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  /**
   * Update state so the next render shows the fallback UI.
   * @param {Error} error
   * @returns {ErrorBoundaryState}
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error, errorInfo: null }
  }

  /**
   * Log the error to the console (hook into monitoring in production).
   * @param {Error} error
   * @param {import('react').ErrorInfo} errorInfo
   */
  componentDidCatch(error, errorInfo) {
    console.error('[OrbitalWatch ErrorBoundary]', this.props.label ?? '', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { error, errorInfo } = this.state
    const label = this.props.label ?? 'OrbitalWatch'

    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          padding: '2rem',
          background: '#0a0a12',
          border: '1px solid rgba(255,68,102,0.3)',
          borderRadius: 12,
          gap: '1rem',
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>🛰️</div>

        {/* Headline */}
        <div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: '#ff4466',
              marginBottom: '0.4rem',
            }}
          >
            Something went wrong in {label}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#8888aa' }}>
            An unexpected error occurred. Please reload to continue.
          </div>
        </div>

        {/* Error message */}
        {error && (
          <pre
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem',
              color: '#ff9d00',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,157,0,0.2)',
              borderRadius: 6,
              padding: '0.75rem 1rem',
              maxWidth: 480,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              textAlign: 'left',
            }}
          >
            {error.message}
            {errorInfo?.componentStack && (
              '\n\nComponent Stack:' + errorInfo.componentStack.slice(0, 400)
            )}
          </pre>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: 8,
              background: 'rgba(0,212,255,0.1)',
              border: '1px solid rgba(0,212,255,0.3)',
              color: '#00d4ff',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: 8,
              background: 'rgba(255,68,102,0.15)',
              border: '1px solid rgba(255,68,102,0.4)',
              color: '#ff4466',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }
}

ErrorBoundary.propTypes = {
  /** Child components to protect */
  children: PropTypes.node.isRequired,
  /** Human-readable label for the boundary shown in the fallback UI */
  label: PropTypes.string,
}

ErrorBoundary.defaultProps = {
  label: 'OrbitalWatch',
}

export default ErrorBoundary
