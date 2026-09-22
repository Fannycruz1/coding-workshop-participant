import { render, act, cleanup, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import App from '../App'
import { AuthProvider } from '../AuthProvider'
import { PAGE_SIZE } from '../lib/constants'

const SESSION = {
  token: 'header.payload.signature',
  user: { id: 1, email: 'admin@acme.inc', full_name: 'Priya', role: 'facility_admin', is_active: true },
}

const incident = (id) => ({
  id, title: `Incident ${id}`, description: null, category: 'HVAC', status: 'Open',
  priority: 'Medium', created_by: 9, assigned_to: null, building_id: 1, floor_id: 10,
  seat_id: null, created_at: '2026-09-22T19:00:00Z', updated_at: null,
  resolved_at: null, closed_at: null, reporter_name: 'Alex', assignee_name: null,
})

const BODIES = {
  '/me': SESSION.user,
  '/buildings': { buildings: [{ id: 1, name: 'HQ', address: null }] },
  '/floors': { floors: [{ id: 10, building_id: 1, floor_number: 1, name: null }] },
  '/seats': { seats: [{ id: 100, floor_id: 10, seat_code: 'A-1' }] },
  '/engineers': { engineers: [{ id: 3, full_name: 'Sofia', specialty: 'HVAC', phone: null }] },
  '/incidents': { incidents: Array.from({ length: PAGE_SIZE }, (_, i) => incident(i + 1)) },
  '/escalations': { escalations: [] },
  '/notes': { notes: [] },
  '/stats/hotspots': {
    buildings: [{ id: 1, name: 'HQ', count: 7 }, { id: 2, name: 'Annex', count: 2 }],
    floors: [{ id: 10, name: 'Floor 1', count: 5 }],
    reporters: [{ id: 9, name: 'Alex', count: 4 }],
  },
  '/stats/categories': { categories: [{ category: 'HVAC', count: 6 }] },
}

const calls = []

const answer = (url) => {
  // apiFetch asks for a same-origin /api/... path in dev, so URL needs a base.
  const { pathname: path, search } = new URL(String(url), 'http://localhost')
  calls.push(path + search)
  const key = path.endsWith('/notes') ? '/notes' : Object.keys(BODIES).find((k) => path.endsWith(k))
  if (!key) throw new Error(`no stubbed answer for ${path}`)
  return { ok: true, json: async () => BODIES[key] }
}

const renderAdmin = () => act(async () => {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>,
  )
})

beforeEach(() => {
  cleanup()
  calls.length = 0
  localStorage.setItem('acme.auth', JSON.stringify(SESSION))
  vi.stubGlobal('fetch', vi.fn(answer))
})

test('the admin dashboard renders without throwing', async () => {
  // This is the test that catches a blank screen: a throw anywhere in the
  // tree lands here rather than in someone's browser.
  const errors = []
  const spy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.join(' ')))

  await renderAdmin()

  spy.mockRestore()
  expect(errors.join('\n')).toBe('')
})

test('a full page of incidents does not fetch a note thread per card', async () => {
  await renderAdmin()

  // Notes live behind <details> and load when opened. Eagerly, this was one
  // request per card — 900 of them against the real seed data.
  expect(calls.filter((call) => call.endsWith('/notes'))).toEqual([])
  expect(calls.length).toBeLessThan(10)
})

test('the incident list asks for a bounded page', async () => {
  await renderAdmin()

  const list = calls.find((call) => call.includes('/incidents'))
  expect(list).toBe(`/api/incidents-service/incidents?limit=${PAGE_SIZE}`)
})

test('stats load only once the tab is opened, and show every group', async () => {
  await renderAdmin()
  expect(calls.filter((call) => call.includes('/stats'))).toEqual([])

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stats' })))

  for (const heading of ['Buildings', 'Floors', 'Reporters', 'Categories']) {
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
  }
  // Every row is one <meter>, the biggest count setting the scale.
  expect(screen.getAllByRole('meter').length).toBe(5)
  expect(screen.getByText('HVAC')).toBeTruthy()
})
