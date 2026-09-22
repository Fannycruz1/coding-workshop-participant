import { useMemo, useState } from 'react'

import IncidentCard from '../components/IncidentCard'
import IncidentFilters from '../components/IncidentFilters'
import { toQuery } from '../lib/incident-fields'
import IncidentNotes from '../components/IncidentNotes'
import { useApi } from '../api'
import { useFacilities, useIncidents } from '../lib/data'
import { TRANSITIONS } from '../lib/constants'
import { useAuth } from '../useAuth'

const NO_FILTERS = { status: '', category: '', priority: '', q: '' }

export default function EngineerDashboard() {
  const api = useApi()
  const { user } = useAuth()
  const [filters, setFilters] = useState(NO_FILTERS)
  const query = useMemo(() => toQuery(filters), [filters])
  // The backend scopes this to my queue plus the unclaimed pool.
  const { incidents, error, reload } = useIncidents(query)
  const facilities = useFacilities()
  const [actionError, setActionError] = useState(null)

  const act = async (path, body) => {
    try {
      await api(path, { method: body.method, body: JSON.stringify(body.payload ?? {}) })
      setActionError(null)
      await reload()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const claim = (incident) => act(
    `/incidents-service/incidents/${incident.id}/assign`, { method: 'POST' },
  )

  const move = (incident, to_status) => act(
    `/incidents-service/incidents/${incident.id}/status`,
    { method: 'PATCH', payload: { to_status } },
  )

  return (
    <main>
      <h1>Engineer queue</h1>
      <IncidentFilters value={filters} onChange={setFilters} />
      {(error || actionError) && <p role="alert">{error || actionError}</p>}
      {incidents.length === 0 && <p className="muted">Nothing assigned or waiting.</p>}

      {incidents.map((incident) => {
        const mine = incident.assigned_to === user.id
        return (
          <IncidentCard key={incident.id} incident={incident} names={facilities.names}>
            {/* Only what the backend would accept: claim if free, move if mine. */}
            {!incident.assigned_to && <button onClick={() => claim(incident)}>Claim</button>}
            {mine && TRANSITIONS[incident.status].map((to) => (
              <button key={to} onClick={() => move(incident, to)}>Mark {to}</button>
            ))}
            <IncidentNotes
              incidentId={incident.id}
              canAdd={mine && incident.status !== 'Closed'}
            />
          </IncidentCard>
        )
      })}
    </main>
  )
}
