import { expect, test } from 'vitest'

import { averageResolutionMs, countBy, formatDuration, openVsResolved } from './reports'

const inc = (status, extra = {}) => ({ status, category: 'HVAC', created_at: '2026-09-01T00:00:00Z', resolved_at: null, ...extra })

test('countBy keeps every ordered label, even at zero', () => {
  const rows = countBy([inc('Open'), inc('Open'), inc('Closed')], (i) => i.status, ['Open', 'Blocked', 'Closed'])
  expect(rows).toEqual([{ label: 'Open', count: 2 }, { label: 'Blocked', count: 0 }, { label: 'Closed', count: 1 }])
})

test('countBy without an order puts the biggest first', () => {
  const rows = countBy([inc('Open', { category: 'A' }), inc('Open', { category: 'B' }), inc('Open', { category: 'B' })], (i) => i.category)
  expect(rows.map((r) => r.label)).toEqual(['B', 'A'])
})

test('open versus resolved treats Resolved and Closed as finished', () => {
  const rows = openVsResolved([inc('Open'), inc('Blocked'), inc('Resolved'), inc('Closed')])
  expect(rows).toEqual([{ label: 'Still open', count: 2 }, { label: 'Resolved or closed', count: 2 }])
})

test('average resolution ignores incidents that were never resolved', () => {
  const list = [inc('Resolved', { resolved_at: '2026-09-01T02:00:00Z' }), inc('Closed', { resolved_at: '2026-09-01T04:00:00Z' }), inc('Open')]
  expect(averageResolutionMs(list)).toBe(3 * 3600e3)
  expect(averageResolutionMs([inc('Open')])).toBeNull()
})

test('durations read in the coarsest sensible units', () => {
  expect(formatDuration(null)).toBe('—')
  expect(formatDuration(25 * 60000)).toBe('25m')
  expect(formatDuration(150 * 60000)).toBe('2h 30m')
  expect(formatDuration(26 * 3600e3)).toBe('1d 2h')
})
