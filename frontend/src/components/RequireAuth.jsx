import { Navigate } from 'react-router-dom'

import { useAuth } from '../useAuth'

/** Mirrors the backend's permission-first rule: no token, no children. */
export default function RequireAuth({ children }) {
  const { token, loading } = useAuth()

  if (loading) return <p>Checking your session…</p>
  if (!token) return <Navigate to="/login" replace />
  return children
}
