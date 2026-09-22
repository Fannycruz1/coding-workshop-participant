import { render, screen, cleanup } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'

import StatusBadge from './StatusBadge'
import { STATUS_COLORS } from '../lib/constants'

beforeEach(cleanup)

test('renders the status label', () => {
  render(<StatusBadge status="In Progress" />)
  expect(screen.getByText('In Progress')).toBeDefined()
})

test('colours each status differently', () => {
  render(<StatusBadge status="Closed" />)
  const closed = screen.getByText('Closed').style.backgroundColor
  cleanup()
  render(<StatusBadge status="Open" />)
  expect(screen.getByText('Open').style.backgroundColor).not.toBe(closed)
})

test('every schema status has a colour', () => {
  for (const status of Object.keys(STATUS_COLORS)) {
    cleanup()
    render(<StatusBadge status={status} />)
    expect(screen.getByText(status).style.backgroundColor).not.toBe('')
  }
})

test('an unknown status still renders rather than blowing up', () => {
  render(<StatusBadge status="Nonsense" />)
  expect(screen.getByText('Nonsense')).toBeDefined()
})
