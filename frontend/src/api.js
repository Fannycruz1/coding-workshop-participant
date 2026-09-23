import { useCallback } from 'react'

// Every call goes through bin/proxy-server.js, which maps /api/<service>/<route>
// onto that service's Lambda Function URL.
//
// In dev we go through Vite's own proxy (see vite.config.js) rather than
// VITE_API_URL: that value is "http://localhost:3001", which is only correct
// for a browser running on this machine. A built bundle has no dev server, so
// it uses VITE_API_URL as bin/generate-env.sh wrote it.
const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

/** Calls the backend and unwraps JSON. Non-2xx throws the API's own error message. */
export async function apiFetch(path, { body, ...options } = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    ...options,
    body,
    // Send the HttpOnly session cookie. Same-origin would cover both stacks today;
    // being explicit keeps it working if the API ever moves to its own domain.
    credentials: 'include',
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })
  // A Lambda cold start or a proxy failure can answer with something that isn't JSON.
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `request failed (${response.status})`)
  return data
}

/** apiFetch, re-exported as a hook so call sites keep one way in. The session
 * cookie rides along on its own, so there is nothing left to attach. */
export function useApi() {
  return useCallback((path, options) => apiFetch(path, options), [])
}
