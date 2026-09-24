import { render, screen, cleanup } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'

import StatusBadge from './StatusBadge'
import { STATUSES } from '../lib/constants'

beforeEach(cleanup)

test('renders the status label', () => {
  render(<StatusBadge status="In Progress" />)
  expect(screen.getByText('In Progress')).toBeDefined()
})

test('every schema status is keyed for its colour', () => {
  for (const status of STATUSES) {
    cleanup()
    render(<StatusBadge status={status} />)
    expect(screen.getByText(status).dataset.status).toBe(status)
  }
})

test('an unknown status still renders rather than blowing up', () => {
  render(<StatusBadge status="Nonsense" />)
  expect(screen.getByText('Nonsense')).toBeDefined()
})
