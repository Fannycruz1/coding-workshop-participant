import { Navigate } from 'react-router-dom'

import { useAuth } from '../useAuth'

/**
 * Mirrors the backend's permission-first rule: no session, no children — and
 * with `roles`, no matching role either. The backend still enforces it; this
 * only keeps a dashboard someone cannot use off their screen.
 */
export default function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth()

  if (loading) return <p>Checking your session…</p>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}
