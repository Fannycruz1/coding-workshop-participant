import { expect, test } from 'vitest'

import { decisionNote, escalationNote, parseNote, statusNote } from './activity'

test('a status change round-trips, with and without a reason', () => {
  expect(parseNote(statusNote('Open', 'In Progress'))).toEqual({ kind: 'status', from: 'Open', to: 'In Progress', reason: undefined })
  expect(parseNote(statusNote('In Progress', 'Blocked', 'Waiting on a part.\nOrdered Monday')))
    .toEqual({ kind: 'status', from: 'In Progress', to: 'Blocked', reason: 'Waiting on a part.\nOrdered Monday' })
})

test('escalation requests and decisions round-trip', () => {
  expect(parseNote(escalationNote('Low', 'High', 'Security risk'))).toEqual({ kind: 'escalation', from: 'Low', to: 'High', reason: 'Security risk' })
  expect(parseNote(decisionNote(true, 'High'))).toEqual({ kind: 'decision', approved: true, to: 'High' })
  expect(parseNote(decisionNote(false, 'High')).approved).toBe(false)
})

test('an ordinary note is left alone', () => {
  expect(parseNote('Technician dispatched to Building A.')).toBeNull()
  expect(parseNote('I Changed status from a chair to a stool')).toBeNull()
})
