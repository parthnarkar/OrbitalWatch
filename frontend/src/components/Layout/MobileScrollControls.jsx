import { ChevronUp, ChevronDown } from 'lucide-react'

/**
 * MobileScrollControls — vertical stack of floating transparent scroll arrows for mobile view.
 * Appears fixed on bottom-right of mobile screens (< 768px).
 */
export default function MobileScrollControls() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
    document.body.scrollTo({ top: 0, behavior: 'smooth' })
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const scrollToBottom = () => {
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.getElementById('main-content')?.scrollHeight || 0
    )
    window.scrollTo({ top: scrollHeight, behavior: 'smooth' })
    document.documentElement.scrollTo({ top: scrollHeight, behavior: 'smooth' })
    document.body.scrollTo({ top: scrollHeight, behavior: 'smooth' })
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.scrollTo({ top: mainContent.scrollHeight, behavior: 'smooth' })
    }
  }

  return (
    <div
      id="mobile-scroll-controls"
      aria-label="Mobile scroll controls"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 80,
        zIndex: 95,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'auto',
      }}
    >
      <style>{`
        @media (min-width: 768px) {
          #mobile-scroll-controls {
            display: none !important;
          }
        }
      `}</style>

      {/* Scroll to top arrow */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        title="Scroll to top"
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'rgba(10, 10, 20, 0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          color: '#00d4ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 212, 255, 0.1)',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)'
          e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(10, 10, 20, 0.45)'
          e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.25)'
        }}
      >
        <ChevronUp size={20} />
      </button>

      {/* Scroll to bottom arrow */}
      <button
        type="button"
        onClick={scrollToBottom}
        aria-label="Scroll to bottom"
        title="Scroll to bottom"
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'rgba(10, 10, 20, 0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          color: '#00d4ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 212, 255, 0.1)',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)'
          e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(10, 10, 20, 0.45)'
          e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.25)'
        }}
      >
        <ChevronDown size={20} />
      </button>
    </div>
  )
}
