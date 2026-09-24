import { expect, test } from 'vitest'

import { filterIncidents, orderIncidents, sortIncidents, validate } from './incident-fields'

const inc = (id, extra = {}) => ({
  id, title: `Incident ${id}`, description: null, category: 'HVAC', priority: 'Low', status: 'Open',
  created_by: 9, assigned_to: null, reporter_name: 'Maria Garcia', assignee_name: null,
  created_at: `2026-09-${10 + id}T10:00:00Z`, updated_at: null, ...extra,
})

const LIST = [
  inc(1, { title: 'Server room AC failed', priority: 'Critical', status: 'Blocked', assigned_to: 3, assignee_name: 'Sofia Reyes' }),
  inc(2, { title: 'Wi-Fi drops', category: 'Network', created_by: 8, reporter_name: 'David Chen', description: 'Every few minutes' }),
  inc(3, { title: 'Printer jams', category: 'Printer', priority: 'High', status: 'Closed' }),
]
const ids = (list) => list.map((i) => i.id)

test('priority triage puts live work first, highest priority first, then newest', () => {
  const list = [inc(1, { priority: 'Critical', status: 'Closed' }), inc(2), inc(3, { priority: 'High' }), inc(4, { priority: 'High' })]
  expect(ids(sortIncidents(list, 'priority'))).toEqual([4, 3, 2, 1])
})

test('search reaches title, description, category, reporter, engineer and id', () => {
  const find = (q) => ids(filterIncidents(LIST, { q }))
  expect(find('server room')).toEqual([1])
  expect(find('few minutes')).toEqual([2])
  expect(find('printer')).toEqual([3])
  expect(find('david')).toEqual([2])
  expect(find('sofia')).toEqual([1])
  expect(find('INC-0002')).toEqual([2])
  expect(find('3')).toEqual([3])
})

test('filters combine, and empty ones are ignored', () => {
  expect(ids(filterIncidents(LIST, { status: 'Blocked', category: '' }))).toEqual([1])
  expect(ids(filterIncidents(LIST, { priority: 'High', status: 'Blocked' }))).toEqual([])
})

test('assignee filter understands me and none', () => {
  expect(ids(filterIncidents(LIST, { assignee: 'me' }, 3))).toEqual([1])
  expect(ids(filterIncidents(LIST, { assignee: 'none' }, 3))).toEqual([2, 3])
  expect(ids(filterIncidents(LIST, { reporter: '8' }))).toEqual([2])
})

test('date created keeps only recent incidents', () => {
  const now = Date.now()
  const list = [inc(1, { created_at: new Date(now - 3600e3).toISOString() }), inc(2, { created_at: new Date(now - 10 * 86400e3).toISOString() })]
  expect(ids(filterIncidents(list, { created: '7d' }))).toEqual([1])
  expect(ids(filterIncidents(list, { created: '30d' }))).toEqual([1, 2])
})

test('ordering by priority and status, either direction, ties newest first', () => {
  expect(ids(orderIncidents(LIST, 'priority', 'desc'))).toEqual([1, 3, 2])
  expect(ids(orderIncidents(LIST, 'status', 'asc'))).toEqual([2, 1, 3])
  expect(ids(orderIncidents(LIST, 'created'))).toEqual([3, 2, 1])
  expect(ids(orderIncidents(LIST, 'created', 'asc'))).toEqual([1, 2, 3])
})

test('the create form insists on title, category, building and floor', () => {
  expect(Object.keys(validate({})).sort()).toEqual(['building_id', 'category', 'floor_id', 'title'])
  expect(validate({ title: '   ', category: 'HVAC', building_id: '1', floor_id: '2' }).title).toBeDefined()
})

test('every sort choice is an ordering orderIncidents understands', async () => {
  const { SORT_CHOICES } = await import('./incident-fields')
  for (const [sort, dir] of SORT_CHOICES) {
    expect(orderIncidents(LIST, sort, dir)).toHaveLength(LIST.length)
  }
})
