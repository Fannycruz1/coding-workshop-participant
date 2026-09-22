import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import IncidentForm from './IncidentForm'
import { validate } from '../lib/incident-fields'

const BUILDINGS = [{ id: 1, name: 'HQ' }, { id: 2, name: 'Annex' }]
const FLOORS = [
  { id: 10, building_id: 1, floor_number: 1, name: 'Ground' },
  { id: 20, building_id: 2, floor_number: 5, name: 'Fifth' },
]
const SEATS = [{ id: 100, floor_id: 10, seat_code: 'A-1' }, { id: 200, floor_id: 20, seat_code: 'B-2' }]

const VALID = { title: 'Aircon dripping', category: 'HVAC', building_id: '1', floor_id: '10' }

beforeEach(cleanup)

test('a complete incident validates', () => {
  expect(validate(VALID)).toEqual({})
})

test('title, category, building and floor are all required', () => {
  expect(Object.keys(validate({})).sort()).toEqual(['building_id', 'category', 'floor_id', 'title'])
})

test('a title of only spaces is not a title', () => {
  expect(validate({ ...VALID, title: '   ' }).title).toBeDefined()
})

const setup = () => {
  const onSubmit = vi.fn()
  render(<IncidentForm buildings={BUILDINGS} floors={FLOORS} seats={SEATS} onSubmit={onSubmit} />)
  return onSubmit
}

const fillValid = () => {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Aircon dripping' } })
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'HVAC' } })
  fireEvent.change(screen.getByLabelText('Building'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Floor'), { target: { value: '10' } })
}

test('an invalid form shows errors and does not submit', () => {
  const onSubmit = setup()

  fireEvent.click(screen.getByRole('button', { name: /report/i }))

  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toBeDefined()
})

test('a valid form submits ids as numbers, with an optional seat', () => {
  const onSubmit = setup()
  fillValid()
  fireEvent.change(screen.getByLabelText(/Seat/), { target: { value: '100' } })

  fireEvent.click(screen.getByRole('button', { name: /report/i }))

  expect(onSubmit).toHaveBeenCalledWith({
    title: 'Aircon dripping',
    description: null,
    category: 'HVAC',
    priority: 'Medium',
    building_id: 1,
    floor_id: 10,
    seat_id: 100,
  })
})

test('no seat chosen sends null, not an empty string', () => {
  const onSubmit = setup()
  fillValid()

  fireEvent.click(screen.getByRole('button', { name: /report/i }))

  expect(onSubmit.mock.calls[0][0].seat_id).toBeNull()
})

test('floors and seats are narrowed to the chosen building', () => {
  setup()
  fireEvent.change(screen.getByLabelText('Building'), { target: { value: '1' } })

  const floors = screen.getByLabelText('Floor').querySelectorAll('option[value]:not([value=""])')
  expect([...floors].map((o) => o.value)).toEqual(['10'])
})

test('changing the building clears a floor that belongs to the old one', () => {
  // Asserted through the payload, not the select: a floor the new building
  // does not own is missing from the options anyway, so the DOM looks cleared
  // either way. Only a submit shows whether the state really was.
  const onSubmit = setup()
  fillValid()
  fireEvent.change(screen.getByLabelText(/Seat/), { target: { value: '100' } })

  fireEvent.change(screen.getByLabelText('Building'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: /report/i }))

  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toMatch(/floor/i)
})
