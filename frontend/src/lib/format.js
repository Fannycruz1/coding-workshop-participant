export const ROLE_LABELS = { employee: 'Employee', engineer: 'Engineer', facility_admin: 'Facility admin' }

export const incidentId = (id) => `INC-${String(id).padStart(4, '0')}`

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

const short = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
export const shortDate = (value) => (value ? short.format(new Date(value)) : '—')

const UNITS = [['day', 86400], ['hour', 3600], ['minute', 60]]
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' })

/** "3 days ago" style age, in the coarsest unit that fits. */
export function age(value) {
  const seconds = (new Date(value) - Date.now()) / 1000
  const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) || UNITS[2]
  return rtf.format(Math.round(seconds / size), unit)
}

/** Where the incident list lives for this role, so search and cards land somewhere they may go. */
export const listPath = (role) => (role === 'employee' ? '/my-incidents' : '/incidents')

const clock = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' })
const DAY = 86400000
const midnight = (d) => new Date(d).setHours(0, 0, 0, 0)

/** "Today at 2:42 PM", "Yesterday at 9:05 AM", "Sep 20 at 3:10 PM". */
export function whenLabel(value) {
  if (!value) return '—'
  const date = new Date(value)
  const days = Math.round((midnight(Date.now()) - midnight(date)) / DAY)
  const day = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : short.format(date)
  return `${day} at ${clock.format(date)}`
}
