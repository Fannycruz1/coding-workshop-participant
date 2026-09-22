import { render, screen, act, cleanup } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import { apiFetch } from './api'

vi.mock('./api', () => ({ apiFetch: vi.fn() }))

const SESSION = {
  token: 'header.payload.signature',
  user: { id: 1, email: 'employee@acme.inc', full_name: 'Employee', role: 'employee', is_active: true },
}

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

test('login stores token and user', async () => {
  apiFetch.mockResolvedValue(SESSION)
  renderApp()

  await act(() => auth.login('employee@acme.inc', 'Password123!'))

  expect(apiFetch).toHaveBeenCalledWith('/auth-service/login', expect.objectContaining({ method: 'POST' }))
  expect(screen.getByText('employee@acme.inc')).toBeDefined()
  expect(JSON.parse(localStorage.getItem('acme.auth'))).toEqual(SESSION)
})

test('login failure leaves nothing stored', async () => {
  apiFetch.mockRejectedValue(new Error('invalid email or password'))
  renderApp()

  await expect(act(() => auth.login('employee@acme.inc', 'wrong'))).rejects.toThrow('invalid email or password')
  expect(localStorage.getItem('acme.auth')).toBeNull()
})

test('a stored session is validated against /me on mount', async () => {
  localStorage.setItem('acme.auth', JSON.stringify(SESSION))
  apiFetch.mockResolvedValue({ ...SESSION.user, full_name: 'Renamed Since Login' })

  await act(async () => { renderApp() })

  expect(apiFetch).toHaveBeenCalledWith('/auth-service/me', { token: SESSION.token })
  expect(auth.user.full_name).toBe('Renamed Since Login')
})

test('a stored session the backend rejects is discarded', async () => {
  localStorage.setItem('acme.auth', JSON.stringify(SESSION))
  apiFetch.mockRejectedValue(new Error('missing or invalid token'))

  await act(async () => { renderApp() })

  expect(screen.getByText('logged out')).toBeDefined()
  expect(localStorage.getItem('acme.auth')).toBeNull()
})

test('no /me call when there is no stored session', async () => {
  await act(async () => { renderApp() })

  expect(apiFetch).not.toHaveBeenCalled()
  expect(screen.getByText('logged out')).toBeDefined()
})

test('logout clears storage', async () => {
  apiFetch.mockResolvedValue(SESSION)
  renderApp()
  await act(() => auth.login('employee@acme.inc', 'Password123!'))

  act(() => auth.logout())

  expect(screen.getByText('logged out')).toBeDefined()
  expect(localStorage.getItem('acme.auth')).toBeNull()
})
