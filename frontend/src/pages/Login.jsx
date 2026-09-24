import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import AuthShell from './AuthShell'
import { useAuth } from '../useAuth'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setBusy(true)
    try {
      await login(form.get('email'), form.get('password'))
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Sign in">
      <form className="stack" onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />

        <button type="submit" className="primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      {error && <p role="alert" className="alert">{error}</p>}
      <p className="muted auth-foot">No account yet? <Link to="/register">Create one</Link></p>
    </AuthShell>
  )
}
