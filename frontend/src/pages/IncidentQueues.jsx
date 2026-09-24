import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import IncidentTable from '../components/IncidentTable'
import IncidentToolbar from '../components/IncidentToolbar'
import PageHeader from '../components/PageHeader'
import { useApi } from '../api'
import { filterIncidents, isUnassigned, NO_FILTERS, orderIncidents } from '../lib/incident-fields'
import { useIncidentData } from '../lib/useIncidentData'
import { useAuth } from '../useAuth'

const unique = (pairs) => [...new Map(pairs.filter(([id]) => id)).entries()]
  .map(([id, name]) => [String(id), name]).sort((a, b) => a[1].localeCompare(b[1]))

/**
 * One list, four pages. `pick` chooses which incidents belong to the page; the
 * toolbar's state lives in the URL, so a dashboard card, a search and a
 * bookmark all land on the same view.
 */
function IncidentList({ title, subtitle, pick, hide, summary, empty, action, error }) {
  const { user } = useAuth()
  const { incidents, loaded, error: loadError } = useIncidentData()
  const [params, setParams] = useSearchParams()

  const base = useMemo(() => pick(incidents, user), [pick, incidents, user])
  const filters = Object.fromEntries(Object.keys(NO_FILTERS).map((k) => [k, params.get(k) ?? '']))
  const sort = params.get('sort') || 'created'
  const dir = params.get('dir') || (sort === 'status' ? 'asc' : 'desc')

  const rows = useMemo(
    () => orderIncidents(filterIncidents(base, filters, user.id), sort, dir),
    // `filters` is rebuilt every render; the query string is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, params, user.id],
  )

  const people = {
    assignees: [
      ...(user.role === 'engineer' ? [['me', 'Assigned to me']] : []),
      ['none', 'Unassigned'],
      ...unique(base.map((i) => [i.assigned_to, i.assignee_name])),
    ],
    reporters: unique(base.map((i) => [i.created_by, i.reporter_name])),
  }

  /** One change, or several at once (sort and direction travel together). */
  function change(name, value) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(typeof name === 'object' ? name : { [name]: value })) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const filtered = Object.values(filters).some(Boolean)
  const nothing = filtered
    ? <>No incidents match these filters. <button type="button" className="link" onClick={() => setParams({}, { replace: true })}>Clear filters</button></>
    : empty

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      {(loadError || error) && <p role="alert" className="alert">{loadError || error}</p>}
      {summary?.(base, loaded)}
      <IncidentToolbar filters={filters} sort={sort} dir={dir} onChange={change} people={people} hide={hide}
        onClear={() => setParams({}, { replace: true })} shown={rows.length} total={base.length} />
      <IncidentTable incidents={rows} loaded={loaded} empty={nothing} action={action} />
    </>
  )
}

export const Incidents = () => (
  <IncidentList title="Incidents" subtitle="Everything you can see, newest first."
    pick={(all) => all} empty="No incidents have been reported yet." />
)

export const MyIncidents = () => (
  <IncidentList title="My Incidents" subtitle="The problems you have reported and where each one stands."
    pick={(all, user) => all.filter((i) => i.created_by === user.id)} hide={['reporter']}
    empty={<>You haven&apos;t reported anything yet. Use <strong>Create Incident</strong> when something needs fixing.</>} />
)

const ASSIGNED_TILES = [['Total assigned', ''], ['In Progress', 'In Progress'], ['Blocked', 'Blocked'], ['Resolved', 'Resolved']]

const assignedSummary = (base, loaded) => (
  <section className="tiles four" aria-label="Your workload">
    {ASSIGNED_TILES.map(([label, status]) => (
      <Link key={label} to={status ? `?status=${encodeURIComponent(status)}` : '.'} className="tile" data-status={status || undefined}>
        <span className="tile-label">{label}</span>
        <strong>{loaded ? base.filter((i) => (status ? i.status === status : i.status !== 'Closed')).length : '–'}</strong>
      </Link>
    ))}
  </section>
)

export const AssignedToMe = () => (
  <IncidentList title="Assigned to Me" subtitle="Work you own. Open one to update its status or add a note."
    pick={(all, user) => all.filter((i) => i.assigned_to === user.id)} hide={['assignee']}
    summary={assignedSummary} empty={<>Nothing is assigned to you. Take work from <Link to="/unassigned">Unassigned</Link>.</>} />
)

export function Unassigned() {
  const api = useApi()
  const { user } = useAuth()
  const { reload } = useIncidentData()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  async function claim(incident) {
    setBusy(incident.id)
    try {
      await api(`/incidents-service/incidents/${incident.id}/assign`, { method: 'POST', body: '{}' })
      setError(null)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <IncidentList title="Unassigned" subtitle="Incidents nobody owns yet. Take one to start working it."
      pick={(all) => all.filter(isUnassigned)} hide={['assignee']} error={error}
      empty="Every live incident has an engineer. Nothing is waiting."
      action={user.role === 'engineer' ? (incident) => (
        <button type="button" className="primary small" disabled={busy === incident.id} onClick={() => claim(incident)}>
          {busy === incident.id ? 'Assigning…' : 'Assign to Me'}
        </button>
      ) : undefined} />
  )
}
