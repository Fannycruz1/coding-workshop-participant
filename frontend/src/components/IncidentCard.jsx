import StatusBadge from './StatusBadge'
import { PRIORITY_COLORS } from '../lib/constants'

const when = (value) => (value ? new Date(value).toLocaleString() : '')

/**
 * One incident, plus whatever actions the role is allowed (as children).
 * `names` turns the facility ids into labels, from the lists the page already
 * loaded. The two user names come with the incident — see repo.READ_COLUMNS.
 */
export default function IncidentCard({ incident, names, children }) {
  const place = [names.buildings[incident.building_id], names.floors[incident.floor_id],
    names.seats[incident.seat_id]].filter(Boolean).join(' · ')

  return (
    <article className="card incident">
      <header>
        <h3>#{incident.id} {incident.title}</h3>
        <div className="badges">
          <StatusBadge status={incident.status} />
          <span className="badge" style={{ backgroundColor: PRIORITY_COLORS[incident.priority] }}>
            {incident.priority}
          </span>
        </div>
      </header>

      {incident.description && <p>{incident.description}</p>}

      <dl className="meta">
        <div><dt>Category</dt><dd>{incident.category}</dd></div>
        <div><dt>Where</dt><dd>{place || '—'}</dd></div>
        <div><dt>Reported by</dt><dd>{incident.reporter_name}</dd></div>
        <div><dt>Assigned to</dt><dd>{incident.assignee_name || 'Unassigned'}</dd></div>
        <div><dt>Reported</dt><dd>{when(incident.created_at)}</dd></div>
      </dl>

      {children}
    </article>
  )
}
