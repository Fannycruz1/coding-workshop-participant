import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { apiFetch } from '../api'
import { useAuth } from '../useAuth'

export default function Register() {
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
      await apiFetch('/auth-service/register', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(form)),
      })
      // Straight in: the password is already in hand, so a second form would
      // only be a second chance to mistype it.
      await login(form.get('email'), form.get('password'))
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="narrow">
      <h1>Create an account</h1>
      <form className="card" onSubmit={onSubmit}>
        <label htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required />

        <label htmlFor="role">Role</label>
        <select id="role" name="role" defaultValue="employee">
          <option value="employee">Employee</option>
          <option value="facility_admin">Facility admin</option>
        </select>

        <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p>Already have an account? <Link to="/login">Sign in</Link></p>
    </main>
  )
}
