// Mirrors db/schema.sql's enums and incidents-service's TRANSITIONS table.
// Kept here so the UI only ever offers a move the backend will accept — the
// backend stays the one that enforces it.
export const CATEGORIES = [
  'HVAC', 'Electrical', 'Plumbing', 'Furniture', 'Network',
  'AV/Conference Room', 'Printer', 'Access/Badge', 'Cleaning', 'Other',
]

// The incidents service's ceiling for `limit`. Lists load this many once and
// search, filter and sort them in the browser.
export const FETCH_LIMIT = 200

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

export const STATUSES = ['Open', 'In Progress', 'Blocked', 'Resolved', 'Closed']

export const TRANSITIONS = {
  Open: ['In Progress'],
  'In Progress': ['Blocked', 'Resolved'],
  Blocked: ['In Progress'],
  Resolved: ['Closed', 'In Progress'],
  Closed: [],
}
