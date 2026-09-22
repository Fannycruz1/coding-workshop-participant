import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiFetch } from './api'
import { AuthContext } from './useAuth'

// Known gap, see docs/build-notes.md: a token in localStorage is readable by XSS.
// Cookies are ruled out while infra/lambda.tf sets allow_credentials = false.
const KEY = 'acme.auth'

const readStored = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStored)
  // A token restored from storage is unverified until /me answers, so hold the
  // routes on "loading" rather than flashing a logged-in UI we may have to undo.
  const [loading, setLoading] = useState(() => Boolean(readStored()))

  const logout = useCallback(() => {
    localStorage.removeItem(KEY)
    setSession(null)
  }, [])

  useEffect(() => {
    const stored = readStored()
    if (!stored) return

    let cancelled = false
    apiFetch('/auth-service/me', { token: stored.token })
      .then((user) => {
        if (cancelled) return
        // Trust the server's copy of the profile over the one saved at login:
        // the role or name may have changed since.
        const next = { ...stored, user }
        localStorage.setItem(KEY, JSON.stringify(next))
        setSession(next)
      })
      .catch(() => {
        if (!cancelled) logout()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // Mount only: a stored token is validated once per page load.
  }, [logout])

  const login = useCallback(async (email, password) => {
    const { token, user } = await apiFetch('/auth-service/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem(KEY, JSON.stringify({ token, user }))
    setSession({ token, user })
  }, [])

  const value = useMemo(
    () => ({ token: session?.token ?? null, user: session?.user ?? null, loading, login, logout }),
    [session, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
