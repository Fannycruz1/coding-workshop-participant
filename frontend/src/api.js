// Every call goes through bin/proxy-server.js, which maps /api/<service>/<route>
// onto that service's Lambda Function URL. VITE_API_URL is written by
// bin/generate-env.sh; the default matches the proxy's hardcoded port.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
