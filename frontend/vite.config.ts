import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Keep SSE working without proxy buffering
        headers: {
          Connection: 'keep-alive',
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.url && req.url.includes('/stream/')) {
              proxyReq.setHeader('Cache-Control', 'no-cache');
              proxyReq.setHeader('Accept', 'text/event-stream');
            }
          });
        },
      },
    },
  },
})
