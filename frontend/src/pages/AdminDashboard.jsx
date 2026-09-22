import { useCallback, useEffect, useMemo, useState } from 'react'

import IncidentCard from '../components/IncidentCard'
import IncidentFilters from '../components/IncidentFilters'
import { toQuery } from '../lib/incident-fields'
import IncidentNotes from '../components/IncidentNotes'
import { useApi } from '../api'
import { useFacilities, useIncidents } from '../lib/data'
import { CATEGORIES } from '../lib/constants'

const NO_FILTERS = { status: '', category: '', priority: '', q: '' }
const TABS = ['Incidents', 'Escalations', 'Facilities', 'Engineers']

function useEngineers() {
  const api = useApi()
  const [engineers, setEngineers] = useState([])
  const reload = useCallback(() => (
    api('/auth-service/engineers').then((data) => setEngineers(data.engineers))
  ), [api])
  useEffect(() => { reload().catch(() => setEngineers([])) }, [reload])
  return { engineers, reload }
}

// --- incidents -------------------------------------------------------------

function Incidents({ facilities, engineers }) {
  const api = useApi()
  const [filters, setFilters] = useState(NO_FILTERS)
  const query = useMemo(() => toQuery(filters), [filters])
  const { incidents, error, reload } = useIncidents(query)
  const [actionError, setActionError] = useState(null)

  const act = async (path, options) => {
    try {
      await api(path, options)
      setActionError(null)
      await reload()
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <>
      <IncidentFilters value={filters} onChange={setFilters} />
      {(error || actionError) && <p role="alert">{error || actionError}</p>}
      {incidents.length === 0 && <p className="muted">No incidents match.</p>}

      {incidents.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} names={facilities.names}>
          <div className="inline">
            <label htmlFor={`assign-${incident.id}`}>Assign to</label>
            <select
              id={`assign-${incident.id}`}
              value={incident.assigned_to ?? ''}
              onChange={(e) => act(`/incidents-service/incidents/${incident.id}/assign`, {
                method: 'POST',
                body: JSON.stringify({ engineer_id: Number(e.target.value) }),
              })}
            >
              <option value="">Unassigned</option>
              {engineers.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.specialty})</option>)}
            </select>
            <button
              className="danger"
              onClick={() => act(`/incidents-service/incidents/${incident.id}`, { method: 'DELETE' })}
            >
              Delete
            </button>
          </div>
          <IncidentNotes incidentId={incident.id} canAdd={incident.status !== 'Closed'} />
        </IncidentCard>
      ))}
    </>
  )
}

// --- escalations -----------------------------------------------------------

function Escalations() {
  const api = useApi()
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  const reload = useCallback(() => (
    api('/incidents-service/escalations?status=Pending')
      .then((data) => setRows(data.escalations))
      .catch((err) => setError(err.message))
  ), [api])
  useEffect(() => { reload() }, [reload])

  const decide = async (id, decision) => {
    try {
      await api(`/incidents-service/escalations/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      })
      setError(null)
      await reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <h2>Pending escalations</h2>
      {error && <p role="alert">{error}</p>}
      {rows.length === 0 && <p className="muted">Nothing waiting on a decision.</p>}
      {rows.map((row) => (
        <article key={row.id} className="card">
          <h3>Incident #{row.incident_id}: {row.current_priority} → {row.requested_priority}</h3>
          <p>{row.reason}</p>
          <div className="inline">
            {/* Approving writes the new priority on the incident, in the same
                transaction as the decision. */}
            <button onClick={() => decide(row.id, 'approve')}>Approve</button>
            <button onClick={() => decide(row.id, 'reject')}>Reject</button>
          </div>
        </article>
      ))}
    </>
  )
}

// --- facilities ------------------------------------------------------------

// One spec per table, the same shape the facilities service stores.
const FACILITY_FIELDS = {
  buildings: [
    { name: 'name', label: 'Name', required: true },
    { name: 'address', label: 'Address' },
  ],
  floors: [
    { name: 'building_id', label: 'Building', parent: 'buildings', required: true },
    { name: 'floor_number', label: 'Floor number', type: 'number', required: true },
    { name: 'name', label: 'Name' },
  ],
  seats: [
    { name: 'floor_id', label: 'Floor', parent: 'floors', required: true },
    { name: 'seat_code', label: 'Seat code', required: true },
  ],
}

function Facilities({ facilities }) {
  const api = useApi()
  const [error, setError] = useState(null)

  const run = async (path, options) => {
    try {
      await api(path, options)
      setError(null)
      await facilities.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  function create(table, event) {
    event.preventDefault()
    const form = event.currentTarget
    const body = {}
    for (const field of FACILITY_FIELDS[table]) {
      const value = new FormData(form).get(field.name)
      if (value === '' || value === null) continue
      body[field.name] = field.type === 'number' || field.parent ? Number(value) : value
    }
    run(`/facilities-service/${table}`, { method: 'POST', body: JSON.stringify(body) })
    form.reset()
  }

  return (
    <>
      {error && <p role="alert">{error}</p>}
      {Object.keys(FACILITY_FIELDS).map((table) => (
        <section key={table} className="card">
          <h2>{table[0].toUpperCase() + table.slice(1)}</h2>

          <form className="inline" onSubmit={(e) => create(table, e)}>
            {FACILITY_FIELDS[table].map((field) => (
              <span key={field.name}>
                <label htmlFor={`${table}-${field.name}`}>{field.label}</label>
                {field.parent ? (
                  <select id={`${table}-${field.name}`} name={field.name} required>
                    <option value="">Choose…</option>
                    {facilities[field.parent].map((row) => (
                      <option key={row.id} value={row.id}>
                        {facilities.names[field.parent][row.id]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`${table}-${field.name}`}
                    name={field.name}
                    type={field.type || 'text'}
                    required={field.required}
                  />
                )}
              </span>
            ))}
            <button type="submit">Add</button>
          </form>

          <ul className="rows">
            {facilities[table].map((row) => (
              <li key={row.id}>
                {facilities.names[table][row.id]}
                <button
                  className="danger"
                  onClick={() => run(`/facilities-service/${table}/${row.id}`, { method: 'DELETE' })}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

// --- engineers -------------------------------------------------------------

function Engineers({ engineers, reload }) {
  const api = useApi()
  const [error, setError] = useState(null)

  const run = async (path, options) => {
    try {
      await api(path, options)
      setError(null)
      await reload()
    } catch (err) {
      setError(err.message)
    }
  }

  function create(event) {
    event.preventDefault()
    const form = event.currentTarget
    run('/auth-service/engineers', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(
        [...new FormData(form)].filter(([, v]) => v !== ''),
      )),
    })
    form.reset()
  }

  return (
    <>
      <h2>Engineers</h2>
      {error && <p role="alert">{error}</p>}

      <form className="card" onSubmit={create}>
        <div className="inline">
          <span><label htmlFor="eng-name">Full name</label>
            <input id="eng-name" name="full_name" required /></span>
          <span><label htmlFor="eng-email">Email</label>
            <input id="eng-email" name="email" type="email" required /></span>
          <span><label htmlFor="eng-password">Password</label>
            <input id="eng-password" name="password" type="password" required /></span>
          <span><label htmlFor="eng-specialty">Specialty</label>
            <select id="eng-specialty" name="specialty" defaultValue="HVAC">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></span>
          <span><label htmlFor="eng-phone">Phone</label>
            <input id="eng-phone" name="phone" /></span>
          <button type="submit">Add engineer</button>
        </div>
      </form>

      <ul className="rows">
        {engineers.map((engineer) => (
          <li key={engineer.id}>
            {engineer.full_name} — {engineer.specialty} {engineer.phone && `· ${engineer.phone}`}
            {/* Deactivates and hands their open work back to the pool. */}
            <button
              className="danger"
              onClick={() => run(`/auth-service/engineers/${engineer.id}`, { method: 'DELETE' })}
            >
              Deactivate
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('Incidents')
  const facilities = useFacilities()
  const { engineers, reload } = useEngineers()

  return (
    <main>
      <h1>Facility admin</h1>
      <div className="tabs">
        {TABS.map((name) => (
          <button
            key={name}
            className={tab === name ? 'active' : ''}
            aria-current={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'Incidents' && <Incidents facilities={facilities} engineers={engineers} />}
      {tab === 'Escalations' && <Escalations />}
      {tab === 'Facilities' && <Facilities facilities={facilities} />}
      {tab === 'Engineers' && <Engineers engineers={engineers} reload={reload} />}
    </main>
  )
}
