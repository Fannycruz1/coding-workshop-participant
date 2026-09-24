import { Link, useNavigate } from 'react-router-dom'

import PriorityTag from './PriorityTag'
import StatusBadge from './StatusBadge'
import { incidentId, shortDate } from '../lib/format'

const COLUMNS = ['ID', 'Title', 'Category', 'Priority', 'Status', 'Reporter', 'Assignee', 'Created', 'Updated']

/**
 * The one way incidents are listed, on every page. `action` adds a last column
 * (e.g. Assign to Me); the row itself always opens the incident.
 */
export default function IncidentTable({ incidents, loaded = true, action, empty }) {
  const navigate = useNavigate()
  const columns = action ? [...COLUMNS, ''] : COLUMNS

  return (
    <div className="table-wrap">
      <table className="incidents">
        <thead>
          <tr>{columns.map((c, i) => <th key={c || i} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {!loaded && Array.from({ length: 5 }, (_, r) => (
            <tr key={r} className="skeleton" aria-hidden="true">
              {columns.map((c, i) => <td key={i}><span /></td>)}
            </tr>
          ))}
          {loaded && incidents.length === 0 && (
            <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>
          )}
          {loaded && incidents.map((incident) => (
            <tr key={incident.id} data-status={incident.status} onClick={() => navigate(`/incidents/${incident.id}`)}>
              <td className="id">{incidentId(incident.id)}</td>
              <td className="title"><Link to={`/incidents/${incident.id}`} onClick={(e) => e.stopPropagation()}>{incident.title}</Link></td>
              <td>{incident.category}</td>
              <td><PriorityTag priority={incident.priority} /></td>
              <td><StatusBadge status={incident.status} /></td>
              <td>{incident.reporter_name}</td>
              <td className={incident.assignee_name ? '' : 'none'}>{incident.assignee_name || 'Unassigned'}</td>
              <td className="date">{shortDate(incident.created_at)}</td>
              <td className="date">{shortDate(incident.updated_at || incident.created_at)}</td>
              {action && <td className="act" onClick={(e) => e.stopPropagation()}>{action(incident)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
