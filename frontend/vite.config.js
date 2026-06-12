/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins = [react()]

  if (!process.env.VITEST) {
    const tailwindcss = (await import('@tailwindcss/vite')).default
    plugins.push(tailwindcss())
  } else {
    // Mock CSS plugin to avoid loading CSS parser/PostCSS in Vitest runs
    const mockCssPlugin = {
      name: 'mock-css-plugin',
      resolveId(id) {
        if (id.endsWith('.css')) {
          return '\0mock-css'
        }
      },
      load(id) {
        if (id === '\0mock-css') {
          return 'export default {}'
        }
      }
    }
    plugins.push(mockCssPlugin)
  }

  return {
    plugins,

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      server: {
        deps: {
          inline: ['@csstools/css-calc', '@asamuzakjp/css-color']
        }
      }
    },

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

    worker: {
      format: 'es',
    },

    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('[Vite Proxy Error] /api:', err.message)
            })
          }
        },
        '/socket.io': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err, req, resOrSocket) => {
              console.log('[Vite Proxy Error] /socket.io:', err.message)
              if (resOrSocket && typeof resOrSocket.writeHead !== 'function') {
                resOrSocket.destroy()
              }
            })
            proxy.on('open', (proxySocket) => {
              proxySocket.on('error', (err) => {
                console.log('[Vite Target WS Socket Error]:', err.message)
              })
            })
            proxy.on('proxyReqWs', (proxyReq, req, socket) => {
              socket.on('error', (err) => {
                console.log('[Vite Client WS Socket Error]:', err.message)
              })
            })
          }
        },
      },
    },
  }
})
