import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiFetch } from './api'
import { AuthContext } from './useAuth'

// The session lives in an HttpOnly cookie set by auth-service, so no script —
// ours or an attacker's — can read it. Nothing is stored in localStorage.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // The cookie is invisible to JS, so /me is the only way to find out whether we
  // are logged in. Hold the routes until it answers rather than flashing a UI.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiFetch('/auth-service/me')
      .then((me) => !cancelled && setUser(me))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
    // Mount only: the cookie is checked once per page load.
  }, [])

  const login = useCallback(async (email, password) => {
    const { user: me } = await apiFetch('/auth-service/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(me)
  }, [])

  // Logging out is now a server call: only the server can clear its own cookie.
  const logout = useCallback(async () => {
    await apiFetch('/auth-service/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
