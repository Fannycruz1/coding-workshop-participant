import { isLive } from './incident-fields'

/** [{label, count}] for `key(incident)`, in `order` if given, otherwise biggest first. Zero rows are kept when ordered. */
export function countBy(incidents, key, order) {
  const counts = new Map(order?.map((label) => [label, 0]))
  for (const i of incidents) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1)
  const rows = [...counts].map(([label, count]) => ({ label, count }))
  return order ? rows : rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** Live work against finished work (Resolved and Closed). */
export const openVsResolved = (incidents) => [
  { label: 'Still open', count: incidents.filter(isLive).length },
  { label: 'Resolved or closed', count: incidents.filter((i) => !isLive(i)).length },
]

/** Mean time from report to resolution, in ms, over incidents that have one. Null when none do. */
export function averageResolutionMs(incidents) {
  const times = incidents.filter((i) => i.resolved_at).map((i) => new Date(i.resolved_at) - new Date(i.created_at))
  return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null
}

/** 93 600 000 ms becomes "1d 2h"; under an hour, minutes. */
export function formatDuration(ms) {
  if (ms === null) return '—'
  const minutes = Math.max(0, Math.round(ms / 60000))
  const [d, h, m] = [Math.floor(minutes / 1440), Math.floor((minutes % 1440) / 60), minutes % 60]
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}
