import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import IncidentFilters from './IncidentFilters'
import { toQuery } from '../lib/incident-fields'

beforeEach(cleanup)

test('no filters means no query string', () => {
  expect(toQuery({})).toBe('')
  expect(toQuery({ status: '', q: '' })).toBe('')
})

test('only the filters that are set end up in the query', () => {
  expect(toQuery({ status: 'Open', category: '', priority: 'High' }))
    .toBe('?status=Open&priority=High')
})

test('values are encoded', () => {
  expect(toQuery({ status: 'In Progress', q: 'a/c broken' }))
    .toBe('?status=In+Progress&q=a%2Fc+broken')
})

test('zero is a real filter value, not an empty one', () => {
  expect(toQuery({ assigned_to: 0 })).toBe('?assigned_to=0')
})

test('changing a filter reports the whole set, not just the change', () => {
  const onChange = vi.fn()
  render(<IncidentFilters value={{ status: '', category: 'HVAC', priority: '', q: '' }} onChange={onChange} />)

  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Blocked' } })

  expect(onChange).toHaveBeenCalledWith({ status: 'Blocked', category: 'HVAC', priority: '', q: '' })
})
