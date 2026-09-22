// Mirrors db/schema.sql's enums and incidents-service's TRANSITIONS table.
// Kept here so the UI only ever offers a move the backend will accept — the
// backend stays the one that enforces it.
export const CATEGORIES = [
  'HVAC', 'Electrical', 'Plumbing', 'Furniture', 'Network',
  'AV/Conference Room', 'Printer', 'Access/Badge', 'Cleaning', 'Other',
]

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

export const STATUSES = ['Open', 'In Progress', 'Blocked', 'Resolved', 'Closed']

export const TRANSITIONS = {
  Open: ['In Progress'],
  'In Progress': ['Blocked', 'Resolved'],
  Blocked: ['In Progress'],
  Resolved: ['Closed', 'In Progress'],
  Closed: [],
}

export const STATUS_COLORS = {
  Open: '#b45309',
  'In Progress': '#1d4ed8',
  Blocked: '#b91c1c',
  Resolved: '#15803d',
  Closed: '#4b5563',
}

export const PRIORITY_COLORS = {
  Low: '#4b5563',
  Medium: '#1d4ed8',
  High: '#b45309',
  Critical: '#b91c1c',
}
