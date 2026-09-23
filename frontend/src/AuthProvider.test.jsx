import { render, screen, act, cleanup } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import { apiFetch } from './api'

vi.mock('./api', () => ({ apiFetch: vi.fn() }))

const USER = { id: 1, email: 'employee@acme.inc', full_name: 'Employee', role: 'employee', is_active: true }

// Probe: renders the auth state and exposes login/logout to the test.
let auth
function Probe() {
  auth = useAuth()
  return <span>{auth.loading ? 'loading' : auth.user?.email ?? 'logged out'}</span>
}

const renderApp = () => render(<AuthProvider><Probe /></AuthProvider>)

beforeEach(() => {
  // vitest runs with globals: false, so Testing Library's auto-cleanup is not registered.
  cleanup()
  localStorage.clear()
  vi.resetAllMocks()
})

test('login sets the user and stores no token anywhere', async () => {
  apiFetch.mockResolvedValue({ user: USER })
  await act(async () => { renderApp() })

  await act(() => auth.login('employee@acme.inc', 'Password123!'))

  expect(apiFetch).toHaveBeenCalledWith('/auth-service/login', expect.objectContaining({ method: 'POST' }))
  expect(screen.getByText('employee@acme.inc')).toBeDefined()
  // The session is an HttpOnly cookie. Nothing readable by script may hold it.
  expect(localStorage.length).toBe(0)
  expect(auth.token).toBeUndefined()
})

test('login failure leaves you logged out', async () => {
  apiFetch.mockRejectedValue(new Error('invalid email or password'))
  await act(async () => { renderApp() })

  await expect(act(() => auth.login('employee@acme.inc', 'wrong'))).rejects.toThrow('invalid email or password')
  expect(screen.getByText('logged out')).toBeDefined()
})

test('the cookie is checked against /me on every mount', async () => {
  apiFetch.mockResolvedValue(USER)

  await act(async () => { renderApp() })

  // No token argument: the cookie rides along on its own.
  expect(apiFetch).toHaveBeenCalledWith('/auth-service/me')
  expect(auth.user.email).toBe('employee@acme.inc')
})

test('a cookie the backend rejects leaves you logged out', async () => {
  apiFetch.mockRejectedValue(new Error('missing or invalid token'))

  await act(async () => { renderApp() })

  expect(screen.getByText('logged out')).toBeDefined()
  expect(auth.user).toBeNull()
})

test('routes are held on loading until /me answers', () => {
  apiFetch.mockReturnValue(new Promise(() => {}))
  renderApp()

  // Without this the app flashes a logged-out UI before the cookie is checked.
  expect(screen.getByText('loading')).toBeDefined()
})

test('logout asks the server to clear the cookie', async () => {
  apiFetch.mockResolvedValue(USER)
  await act(async () => { renderApp() })

  await act(() => auth.logout())

  // Only the server can clear its own HttpOnly cookie — dropping local state is not logout.
  expect(apiFetch).toHaveBeenCalledWith('/auth-service/logout', { method: 'POST' })
  expect(screen.getByText('logged out')).toBeDefined()
})
