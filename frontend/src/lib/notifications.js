import { incidentId } from './format'
import { isLive, isUnassigned } from './incident-fields'

const DAY = 86400000

/** What deserves this user's attention, worked out from the incidents already loaded. */
export function notificationsFor(user, incidents) {
  const item = (i, text) => ({ id: `${i.id}-${text}`, to: `/incidents/${i.id}`, text: `${incidentId(i.id)} ${text}` })
  const recent = (i) => Date.now() - new Date(i.updated_at || i.created_at) < 3 * DAY
  let out

  if (user.role === 'employee') {
    out = incidents.filter((i) => i.status === 'Resolved').map((i) => item(i, 'was resolved. Check the fix.'))
    out.push(...incidents.filter((i) => i.status === 'Blocked' && recent(i)).map((i) => item(i, 'is blocked.')))
  } else if (user.role === 'engineer') {
    out = incidents.filter((i) => i.assigned_to === user.id && i.status === 'Blocked').map((i) => item(i, 'is blocked on you.'))
    out.push(...incidents.filter((i) => isUnassigned(i) && ['High', 'Critical'].includes(i.priority))
      .map((i) => item(i, `${i.priority.toLowerCase()} priority, unassigned.`)))
  } else {
    out = incidents.filter((i) => isLive(i) && i.priority === 'Critical').map((i) => item(i, 'is critical.'))
    out.push(...incidents.filter((i) => i.status === 'Blocked').map((i) => item(i, 'is blocked.')))
  }
  return out.slice(0, 8)
}
