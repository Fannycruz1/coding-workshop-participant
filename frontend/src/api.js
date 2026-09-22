import { useCallback } from 'react'

import { useAuth } from './useAuth'

// Every call goes through bin/proxy-server.js, which maps /api/<service>/<route>
// onto that service's Lambda Function URL.
//
// In dev we go through Vite's own proxy (see vite.config.js) rather than
// VITE_API_URL: that value is "http://localhost:3001", which is only correct
// for a browser running on this machine. A built bundle has no dev server, so
// it uses VITE_API_URL as bin/generate-env.sh wrote it.
const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

/** Calls the backend and unwraps JSON. Non-2xx throws the API's own error message. */
export async function apiFetch(path, { token, body, ...options } = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    ...options,
    body,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })
  // A Lambda cold start or a proxy failure can answer with something that isn't JSON.
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `request failed (${response.status})`)
  return data
}

/** apiFetch with the logged-in token already attached — every dashboard call needs it. */
export function useApi() {
  const { token } = useAuth()
  return useCallback((path, options) => apiFetch(path, { ...options, token }), [token])
}
