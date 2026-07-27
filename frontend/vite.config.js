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

    // Target modern browsers — es2022 avoids esbuild 0.28.x destructuring
    // transform errors (es2020 triggers a known regression in that version)
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },

    build: {
      target: 'es2022',
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
            // Defer detaching Vite's default handler using process.nextTick
            process.nextTick(() => {
              proxy.removeAllListeners('error')
              proxy.on('error', (err, _req, res) => {
                if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED' && err.code !== 'EPIPE') {
                  console.log('[Vite Proxy Error] /api:', err.message || err)
                }
                if (res && typeof res.writeHead === 'function') {
                  if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'text/plain' })
                  }
                  res.end('Bad Gateway')
                }
              })
            })
          }
        },
        '/ping': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            // Defer detaching Vite's default handler using process.nextTick
            process.nextTick(() => {
              proxy.removeAllListeners('error')
              proxy.on('error', (err, _req, res) => {
                if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED' && err.code !== 'EPIPE') {
                  console.log('[Vite Proxy Error] /ping:', err.message || err)
                }
                if (res && typeof res.writeHead === 'function') {
                  if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'text/plain' })
                  }
                  res.end('Bad Gateway')
                }
              })
            })
          }
        },
        '/socket.io': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            // Remove Vite's default error listener to prevent noisy console logs for aborted/reset sockets.
            // We defer this with process.nextTick to ensure it runs after Vite has attached its internal handlers.
            process.nextTick(() => {
              proxy.removeAllListeners('error')
              proxy.on('error', (err, _req, resOrSocket) => {
                if (
                  err.code !== 'ECONNRESET' &&
                  err.code !== 'ECONNABORTED' &&
                  err.code !== 'ECONNREFUSED' &&
                  err.code !== 'EPIPE'
                ) {
                  console.log('[Vite Proxy Error] /socket.io:', err.message)
                }
                if (resOrSocket) {
                  if (typeof resOrSocket.destroy === 'function') {
                    resOrSocket.destroy()
                  } else if (typeof resOrSocket.writeHead === 'function') {
                    if (!resOrSocket.headersSent) {
                      resOrSocket.writeHead(502, { 'Content-Type': 'text/plain' })
                    }
                    resOrSocket.end('Bad Gateway')
                  }
                }
              })
            })

            proxy.on('open', (proxySocket) => {
              proxySocket.on('error', (err) => {
                if (
                  err.code !== 'ECONNRESET' &&
                  err.code !== 'ECONNABORTED' &&
                  err.code !== 'EPIPE'
                ) {
                  console.log('[Vite Target WS Socket Error]:', err.message)
                }
              })
            })

            proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
              // Remove Vite's default error listener from the client socket
              socket.removeAllListeners('error')

              socket.on('error', (err) => {
                if (
                  err.code !== 'ECONNRESET' &&
                  err.code !== 'ECONNABORTED' &&
                  err.code !== 'EPIPE'
                ) {
                  console.log('[Vite Client WS Socket Error]:', err.message)
                }
              })
            })
          }
        },
      },
    },
  }
})
