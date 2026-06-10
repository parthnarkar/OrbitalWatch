import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Target modern browsers for smaller output
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Three.js ecosystem — largest dependency (~688 kB min)
          'vendor-three': ['three'],
          // React 3D helpers
          'vendor-r3f': ['@react-three/fiber', '@react-three/drei'],
          // Charts
          'vendor-recharts': ['recharts'],
          // Socket.IO client
          'vendor-socketio': ['socket.io-client'],
        },
      },
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
