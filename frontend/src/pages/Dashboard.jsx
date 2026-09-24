import { Link } from 'react-router-dom'

import IncidentTable from '../components/IncidentTable'
import PageHeader from '../components/PageHeader'
import { listPath } from '../lib/format'
import { isLive, isUnassigned, sortIncidents } from '../lib/incident-fields'
import { useIncidentData } from '../lib/useIncidentData'
import { useAuth } from '../useAuth'

const TILES = [
  ['Open', 'Open'], ['In Progress', 'In Progress'], ['Blocked', 'Blocked'],
  ['Resolved', 'Resolved'], ['Closed', 'Closed'],
]

export default function Dashboard() {
  const { user } = useAuth()
  const { incidents, loaded, error } = useIncidentData()
  const base = listPath(user.role)
  const unassigned = incidents.filter(isUnassigned).length
  const attention = sortIncidents(incidents.filter(isLive), 'priority').slice(0, 8)
  const blocked = incidents.filter((i) => i.status === 'Blocked').length

  const subtitle = !loaded ? 'Loading the current state…'
    : blocked ? `${blocked} blocked, ${unassigned} without an engineer.` : `${unassigned} without an engineer. Nothing is blocked.`

  return (
    <>
      <PageHeader title="Dashboard" subtitle={subtitle} />
      {error && <p role="alert" className="alert">{error}</p>}

      <section className="tiles" aria-label="Incident summary">
        {TILES.map(([label, status]) => (
          <Link key={status} to={`${base}?status=${encodeURIComponent(status)}`} className="tile" data-status={status}>
            <span className="tile-label">{label}</span>
            <strong>{loaded ? incidents.filter((i) => i.status === status).length : '–'}</strong>
          </Link>
        ))}
        <Link to={user.role === 'employee' ? `${base}?assignee=none` : '/unassigned'} className="tile" data-alert={unassigned > 0}>
          <span className="tile-label">Unassigned</span>
          <strong>{loaded ? unassigned : '–'}</strong>
        </Link>
      </section>

      <section>
        <div className="section-head">
          <h2>Needs attention</h2>
          <Link to={base} className="link-arrow">All incidents</Link>
        </div>
        <IncidentTable incidents={attention} loaded={loaded}
          empty="Nothing is open. New incidents will appear here as they are reported." />
      </section>
    </>
  )
}
