import { useMemo, useState } from 'react'

import IncidentCard from '../components/IncidentCard'
import IncidentFilters from '../components/IncidentFilters'
import { toQuery } from '../lib/incident-fields'
import IncidentForm from '../components/IncidentForm'
import IncidentNotes from '../components/IncidentNotes'
import { useApi } from '../api'
import { useFacilities, useIncidents } from '../lib/data'
import { PAGE_SIZE, PRIORITIES } from '../lib/constants'

const NO_FILTERS = { status: '', category: '', priority: '', q: '' }

/** Ask for a higher priority. The backend refuses anything that isn't higher. */
function Escalate({ incident, onDone }) {
  const api = useApi()
  const above = PRIORITIES.slice(PRIORITIES.indexOf(incident.priority) + 1)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  if (above.length === 0) return <p className="muted">Already at the highest priority.</p>
  if (!open) return <button onClick={() => setOpen(true)}>Request escalation</button>

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api(`/incidents-service/incidents/${incident.id}/escalate`, {
        method: 'POST',
        body: JSON.stringify({
          requested_priority: form.get('requested_priority'),
          reason: form.get('reason'),
        }),
      })
      setOpen(false)
      setError(null)
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="inline" onSubmit={submit}>
      <label htmlFor={`prio-${incident.id}`}>Raise to</label>
      <select id={`prio-${incident.id}`} name="requested_priority" defaultValue={above[0]}>
        {above.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input name="reason" placeholder="Why is this more urgent?" required />
      <button type="submit">Send</button>
      <button type="button" onClick={() => { setOpen(false); setError(null) }}>Cancel</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export default function EmployeeDashboard() {
  const api = useApi()
  const [filters, setFilters] = useState(NO_FILTERS)
  const query = useMemo(() => toQuery({ ...filters, limit: PAGE_SIZE }), [filters])
  const { incidents, error, reload } = useIncidents(query)
  const facilities = useFacilities()
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)

  async function report(body) {
    setBusy(true)
    try {
      await api('/incidents-service/incidents', { method: 'POST', body: JSON.stringify(body) })
      setFormError(null)
      await reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <h1>My incidents</h1>

      <IncidentForm
        buildings={facilities.buildings}
        floors={facilities.floors}
        seats={facilities.seats}
        onSubmit={report}
        busy={busy}
      />
      {formError && <p role="alert">{formError}</p>}

      <IncidentFilters value={filters} onChange={setFilters} />
      {error && <p role="alert">{error}</p>}
      {incidents.length === 0 && <p className="muted">Nothing here yet.</p>}
      {incidents.length === PAGE_SIZE && (
        <p className="muted">Showing the newest {PAGE_SIZE}. Narrow with the filters above.</p>
      )}

      {incidents.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} names={facilities.names}>
          {/* The reporter may always note and escalate, until it is Closed. */}
          <IncidentNotes incidentId={incident.id} canAdd={incident.status !== 'Closed'} />
          {incident.status !== 'Closed' && <Escalate incident={incident} onDone={reload} />}
        </IncidentCard>
      ))}
    </main>
  )
}
