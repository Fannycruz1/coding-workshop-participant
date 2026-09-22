import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind all interfaces like bin/proxy-server.js does, so the dev server is
    // reachable when the repo runs on a remote box rather than your laptop.
    host: true,
    port: 3000
  },
  test: {
    environment: 'jsdom',
    globals: false
  }
})
