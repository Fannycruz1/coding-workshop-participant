import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import ActivityFeed from '../components/ActivityFeed'
import IncidentActions from '../components/IncidentActions'
import PriorityTag from '../components/PriorityTag'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../api'
import { decisionNote } from '../lib/activity'
import { incidentId, listPath, whenLabel } from '../lib/format'
import { useIncidentData } from '../lib/useIncidentData'
import { useAuth } from '../useAuth'

const EMPTY = { incident: null, notes: [], error: null, loaded: false }

export default function IncidentDetail() {
  const { id } = useParams()
  const api = useApi()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { reload: reloadList, facilities } = useIncidentData()
  const [state, setState] = useState(EMPTY)
  const [notice, setNotice] = useState(null)
  const latest = useRef(0)
  const composer = useRef(null)

  // Only the newest request may write, so a slow older answer can't overwrite it.
  const load = useCallback(() => {
    const mine = ++latest.current
    return Promise.all([
      api(`/incidents-service/incidents/${id}`),
      api(`/incidents-service/incidents/${id}/notes`),
    ])
      .then(([{ incident }, { notes }]) => { if (mine === latest.current) setState({ incident, notes, error: null, loaded: true }) })
      .catch((err) => { if (mine === latest.current) setState({ ...EMPTY, error: err.message, loaded: true }) })
  }, [api, id])

  useEffect(() => { load() }, [load])

  // Only admins may list escalations; the rest learn of one from the feed.
  const isAdmin = user.role === 'facility_admin'
  const [pending, setPending] = useState(null)
  const loadPending = useCallback(() => (
    isAdmin
      ? api('/incidents-service/escalations?status=Pending')
        .then((d) => setPending(d.escalations.find((e) => e.incident_id === Number(id)) ?? null))
        .catch(() => setPending(null))
      : Promise.resolve()
  ), [api, id, isAdmin])
  useEffect(() => { loadPending() }, [loadPending])

  const incident = state.incident?.id === Number(id) ? state.incident : null
  const back = listPath(user.role)

  if (!incident) {
    return (
      <>
        <Link to={back} className="back">← Back to incidents</Link>
        {state.loaded && state.error
          ? <p role="alert" className="alert">{state.error === 'incident not found' ? 'This incident does not exist, or you can’t see it.' : state.error}</p>
          : <div className="skeleton-block" aria-busy="true" aria-label="Loading incident" />}
      </>
    )
  }

  const refresh = async (message) => {
    setNotice(typeof message === 'string' ? message : null)
    await Promise.all([load(), loadPending(), reloadList()])
  }

  const remove = async () => {
    try {
      await api(`/incidents-service/incidents/${incident.id}`, { method: 'DELETE' })
      await reloadList()
      navigate(back, { replace: true })
    } catch (err) {
      setNotice(err.message)
    }
  }

  const decide = async (approved) => {
    try {
      await api(`/incidents-service/escalations/${pending.id}/decide`, {
        method: 'POST', body: JSON.stringify({ decision: approved ? 'approve' : 'reject' }),
      })
      await api(`/incidents-service/incidents/${incident.id}/notes`, {
        method: 'POST', body: JSON.stringify({ body: decisionNote(approved, pending.requested_priority) }),
      }).catch(() => {})
      await refresh()
    } catch (err) {
      setNotice(err.message)
    }
  }

  const addNote = async (body) => {
    await api(`/incidents-service/incidents/${incident.id}/notes`, { method: 'POST', body: JSON.stringify({ body }) })
    await load()
  }

  const { names } = facilities
  const place = [names.buildings[incident.building_id], names.floors[incident.floor_id], names.seats[incident.seat_id]]
    .filter(Boolean).join(' · ')
  const canNote = incident.status !== 'Closed'
    && (user.role === 'facility_admin' || incident.created_by === user.id || incident.assigned_to === user.id)

  const focusNote = () => {
    composer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    composer.current?.focus({ preventScroll: true })
  }

  return (
    <>
      <Link to={back} className="back">← Back to incidents</Link>

      <div className="incident-layout">
        <header className="incident-head">
          <p className="incident-id">{incidentId(incident.id)} <StatusBadge status={incident.status} /></p>
          <h1>{incident.title}</h1>
          <IncidentActions incident={incident} user={user} canNote={canNote} onNote={focusNote}
            onDone={refresh} onDelete={remove} api={api} />
          {notice && <p role="status" className="notice">{notice}</p>}
          {pending && (
            <div className="escalation" role="region" aria-label="Escalation request">
              <div>
                <strong>Escalation requested: {pending.current_priority} to {pending.requested_priority}</strong>
                <p>{pending.reason}</p>
              </div>
              <div className="escalation-actions">
                <button type="button" className="primary" onClick={() => decide(true)}>Approve</button>
                <button type="button" onClick={() => decide(false)}>Reject</button>
              </div>
            </div>
          )}
        </header>

        <section className="description" aria-labelledby="desc-title">
          <h2 id="desc-title">Description</h2>
          {incident.description ? <p>{incident.description}</p> : <p className="muted">No description was provided.</p>}
        </section>

        <ActivityFeed incident={incident} notes={state.notes} user={user} canNote={canNote} onAdd={addNote} composer={composer} />

        <aside className="rail" aria-label="Incident details">
          <h2>Details</h2>
          <dl>
            <div><dt>Status</dt><dd><StatusBadge status={incident.status} /></dd></div>
            <div><dt>Priority</dt><dd><PriorityTag priority={incident.priority} /></dd></div>
            <div><dt>Category</dt><dd>{incident.category}</dd></div>
            <div><dt>Location</dt><dd>{place || '—'}</dd></div>
            <div><dt>Reporter</dt><dd>{incident.reporter_name}</dd></div>
            <div><dt>Assignee</dt><dd className={incident.assignee_name ? '' : 'none'}>{incident.assignee_name || 'Unassigned'}</dd></div>
            <div><dt>Created</dt><dd>{whenLabel(incident.created_at)}</dd></div>
            <div><dt>Updated</dt><dd>{whenLabel(incident.updated_at || incident.created_at)}</dd></div>
          </dl>
        </aside>
      </div>
    </>
  )
}
