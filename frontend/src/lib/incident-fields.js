import { PRIORITIES, STATUSES } from './constants'
import { incidentId } from './format'

// The pure bits of the incident UI: what the form insists on, and how a list is
// narrowed and ordered. Out of the components so each stays testable on its own.

/** The same four required fields the backend's IncidentCreate model demands. */
export function validate(values) {
  const errors = {}
  if (!values.title?.trim()) errors.title = 'a title is required'
  if (!values.category) errors.category = 'pick a category'
  if (!values.building_id) errors.building_id = 'pick a building'
  if (!values.floor_id) errors.floor_id = 'pick a floor'
  return errors
}

/** Client-side triage order: live work first, then highest priority, then newest. */
export function sortIncidents(incidents, sort) {
  if (sort !== 'priority') return incidents
  const done = (i) => (i.status === 'Resolved' || i.status === 'Closed' ? 1 : 0)
  return [...incidents].sort((a, b) => (
    done(a) - done(b) || PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority) || b.id - a.id
  ))
}

/** Not yet finished: Open, In Progress or Blocked. */
export const isLive = (i) => i.status !== 'Resolved' && i.status !== 'Closed'

/** Nobody owns it and it still needs someone. */
export const isUnassigned = (i) => !i.assigned_to && isLive(i)

export const NO_FILTERS = { q: '', status: '', category: '', priority: '', assignee: '', reporter: '', created: '' }

const DAY = 86400000
const CREATED_SINCE = {
  today: () => new Date().setHours(0, 0, 0, 0),
  '7d': () => Date.now() - 7 * DAY,
  '30d': () => Date.now() - 30 * DAY,
}

/** Applies the toolbar's filters. `assignee` is an engineer id, 'me' or 'none'. */
export function filterIncidents(incidents, filters, meId) {
  const f = { ...NO_FILTERS, ...filters }
  const q = f.q.trim().toLowerCase()
  const asId = q.match(/^(?:inc-?)?0*(\d+)$/)?.[1]
  const since = CREATED_SINCE[f.created]?.()
  const assignee = f.assignee === 'me' ? String(meId) : f.assignee

  return incidents.filter((i) => (
    (!q || asId === String(i.id) || [incidentId(i.id), i.title, i.description, i.category, i.reporter_name, i.assignee_name]
      .some((field) => field?.toLowerCase().includes(q)))
    && (!f.status || i.status === f.status)
    && (!f.category || i.category === f.category)
    && (!f.priority || i.priority === f.priority)
    && (!f.reporter || String(i.created_by) === f.reporter)
    && (!since || new Date(i.created_at) >= since)
    && (!assignee || (assignee === 'none' ? !i.assigned_to : String(i.assigned_to) === assignee))
  ))
}

/** [sort, dir, label]: the one sort control offers each ordering by name. */
export const SORT_CHOICES = [
  ['created', 'desc', 'Newest created'], ['created', 'asc', 'Oldest created'],
  ['updated', 'desc', 'Recently updated'], ['updated', 'asc', 'Least recently updated'],
  ['priority', 'desc', 'Priority, highest first'], ['priority', 'asc', 'Priority, lowest first'],
  ['status', 'asc', 'Status, Open to Closed'], ['status', 'desc', 'Status, Closed to Open'],
]

const KEYS = {
  created: (i) => new Date(i.created_at).getTime(),
  updated: (i) => new Date(i.updated_at || i.created_at).getTime(),
  priority: (i) => PRIORITIES.indexOf(i.priority),
  status: (i) => STATUSES.indexOf(i.status),
}

/** Orders a list by one of SORT_CHOICES. Ties fall back to newest first, whichever way `dir` points. */
export function orderIncidents(incidents, sort = 'created', dir = 'desc') {
  const key = KEYS[sort] || KEYS.created
  const sign = dir === 'asc' ? 1 : -1
  return [...incidents].sort((a, b) => sign * (key(a) - key(b)) || b.id - a.id)
}
