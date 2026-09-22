import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind all interfaces like bin/proxy-server.js does, so the dev server is
    // reachable when the repo runs on a remote box rather than your laptop.
    host: true,
    port: 3000,
    // Dev calls go to this server's own /api and are forwarded to the proxy.
    // That keeps them same-origin, so the app works from any machine that can
    // reach this one — "localhost" in a browser elsewhere is that machine.
    proxy: { '/api': 'http://localhost:3001' }
  },
  test: {
    environment: 'jsdom',
    globals: false
  }
})
