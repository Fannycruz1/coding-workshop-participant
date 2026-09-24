import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import App from '../App'
import { AuthProvider } from '../AuthProvider'

const USERS = {
  employee: { id: 9, email: 'alex@acme.inc', full_name: 'Alex Johnson', role: 'employee', is_active: true },
  engineer: { id: 3, email: 'sofia@acme.inc', full_name: 'Sofia Reyes', role: 'engineer', is_active: true },
  admin: { id: 1, email: 'admin@acme.inc', full_name: 'Priya Natarajan', role: 'facility_admin', is_active: true },
}

const INCIDENT = {
  id: 7, title: 'Printer jams', description: 'Every duplex job.', category: 'Printer', status: 'Open',
  priority: 'Low', created_by: 9, assigned_to: null, building_id: 1, floor_id: 10, seat_id: null,
  created_at: '2026-09-22T19:00:00Z', updated_at: null, resolved_at: null, closed_at: null,
  reporter_name: 'Alex Johnson', assignee_name: null,
}

let me
const answer = (url) => {
  const path = new URL(String(url), 'http://localhost').pathname
  const body = path.endsWith('/me') ? me
    : path.endsWith('/notes') ? { notes: [{ id: 1, author_id: 9, author_name: 'Alex Johnson', body: 'Second jam today.', created_at: '2026-09-22T20:00:00Z' }] }
      : path.endsWith('/incidents/7') ? { incident: INCIDENT }
        : path.endsWith('/incidents') ? { incidents: [INCIDENT] }
          : path.endsWith('/buildings') ? { buildings: [{ id: 1, name: 'HQ' }] }
            : path.endsWith('/floors') ? { floors: [{ id: 10, building_id: 1, floor_number: 1, name: null }] }
              : path.endsWith('/seats') ? { seats: [] } : {}
  return { ok: true, json: async () => body }
}

async function open(role) {
  me = USERS[role]
  await act(async () => {
    render(<MemoryRouter initialEntries={['/incidents/7']}><AuthProvider><App /></AuthProvider></MemoryRouter>)
  })
}

const has = (name) => screen.queryAllByRole('button', { name }).length > 0

beforeEach(() => {
  cleanup()
  vi.stubGlobal('fetch', vi.fn(answer))
})

test('the page shows the incident, its description and its activity', async () => {
  await open('admin')
  expect(screen.getByRole('heading', { name: 'Printer jams' })).toBeTruthy()
  expect(screen.getByText('INC-0007')).toBeTruthy()
  expect(screen.getByText('Every duplex job.')).toBeTruthy()
  expect(screen.getByText('Second jam today.')).toBeTruthy()
  expect(screen.getByText('Reported this incident')).toBeTruthy()
})

test('an employee can add a note but not move or delete their incident', async () => {
  await open('employee')
  expect(has('Add Note')).toBe(true)
  expect(has('Escalate')).toBe(true)
  for (const name of ['Change Status', 'Assign to Me', 'Assign Engineer', 'Delete Incident']) expect(has(name)).toBe(false)
})

test('an engineer can take an unassigned incident but not delete it', async () => {
  await open('engineer')
  expect(has('Assign to Me')).toBe(true)
  // Not theirs yet, so no status moves and no notes until they take it.
  expect(has('Change Status')).toBe(false)
  expect(has('Add Note')).toBe(false)
  expect(has('Delete Incident')).toBe(false)
})

test('an admin can assign, move, note and delete, but not escalate someone else\'s incident', async () => {
  await open('admin')
  for (const name of ['Assign Engineer', 'Change Status', 'Add Note', 'Delete Incident']) expect(has(name)).toBe(true)
  expect(has('Escalate')).toBe(false)
})

test('the page has no status bar and puts the description right after the title', async () => {
  await open('admin')
  expect(screen.queryByRole('list', { name: 'Workflow' })).toBeNull()
  const heading = screen.getByRole('heading', { name: 'Printer jams' })
  const description = screen.getByRole('heading', { name: 'Description' })
  const activity = screen.getByRole('heading', { name: 'Activity' })
  expect(heading.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(description.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('a note is shown as the note itself, and a recorded status change as an event', async () => {
  await open('admin')
  expect(screen.queryByText('Added note')).toBeNull()
  expect(screen.getByText('Second jam today.')).toBeTruthy()
})
