import { useEffect, useState } from 'react'

import ConfirmButton from './ConfirmButton'
import DialogForm from './DialogForm'
import { useApi } from '../api'
import { PRIORITIES, TRANSITIONS } from '../lib/constants'
import { escalationNote, statusNote } from '../lib/activity'
import { incidentId } from '../lib/format'
import { useSubmit } from '../lib/useSubmit'

/** Best effort: the change itself has already succeeded, so a failed note must not undo it. */
const record = (api, incident, body) => api(`/incidents-service/incidents/${incident.id}/notes`, {
  method: 'POST', body: JSON.stringify({ body }),
}).catch(() => {})

function StatusDialog({ incident, onClose, onDone }) {
  const api = useApi()
  const { error, busy, submit } = useSubmit(async (f) => {
    const to = f.get('to_status')
    const reason = f.get('reason').trim()
    await api(`/incidents-service/incidents/${incident.id}/status`, {
      method: 'PATCH', body: JSON.stringify({ to_status: to, reason: reason || null }),
    })
    // A closed incident takes no more notes; its closed_at row in the feed covers it.
    if (to !== 'Closed') await record(api, incident, statusNote(incident.status, to, reason))
  }, onDone)

  return (
    <DialogForm title="Change status" onClose={onClose} submit={submit} error={error} busy={busy} confirm="Update status">
      <p className="muted">Currently <strong>{incident.status}</strong>. Only the moves the workflow allows are offered.</p>
      <label htmlFor="to_status">New status</label>
      <select id="to_status" name="to_status">
        {TRANSITIONS[incident.status].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label htmlFor="reason">Reason (optional)</label>
      <textarea id="reason" name="reason" rows="3" placeholder="For Blocked, say what is in the way." />
    </DialogForm>
  )
}

function AssignDialog({ incident, onClose, onDone }) {
  const api = useApi()
  const [engineers, setEngineers] = useState(null)
  useEffect(() => { api('/auth-service/engineers').then((d) => setEngineers(d.engineers)).catch(() => setEngineers([])) }, [api])

  const { error, busy, submit } = useSubmit((f) => api(`/incidents-service/incidents/${incident.id}/assign`, {
    method: 'POST', body: JSON.stringify({ engineer_id: Number(f.get('engineer_id')) }),
  }), onDone)

  return (
    <DialogForm title="Assign engineer" onClose={onClose} submit={submit} error={error} busy={busy || !engineers?.length} confirm="Assign">
      <label htmlFor="engineer_id">Engineer</label>
      <select id="engineer_id" name="engineer_id" defaultValue={incident.assigned_to ?? ''} disabled={!engineers}>
        {!engineers && <option>Loading…</option>}
        {engineers?.length === 0 && <option>No engineers available</option>}
        {engineers?.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.specialty})</option>)}
      </select>
    </DialogForm>
  )
}

function EscalateDialog({ incident, onClose, onDone }) {
  const api = useApi()
  const above = PRIORITIES.slice(PRIORITIES.indexOf(incident.priority) + 1)
  const { error, busy, submit } = useSubmit(async (f) => {
    const to = f.get('requested_priority')
    const reason = f.get('reason').trim()
    await api(`/incidents-service/incidents/${incident.id}/escalate`, {
      method: 'POST', body: JSON.stringify({ requested_priority: to, reason }),
    })
    await record(api, incident, escalationNote(incident.priority, to, reason))
  }, () => onDone('Escalation requested. An admin will decide.'))

  return (
    <DialogForm title="Escalate" onClose={onClose} submit={submit} error={error} busy={busy} confirm="Request escalation">
      <p className="muted">Currently <strong>{incident.priority}</strong>. An admin approves or rejects the request.</p>
      <label htmlFor="requested_priority">Raise to</label>
      <select id="requested_priority" name="requested_priority" defaultValue={above[0]}>
        {above.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <label htmlFor="esc-reason">Why is it more urgent?</label>
      <textarea id="esc-reason" name="reason" rows="3" required />
    </DialogForm>
  )
}

/**
 * The role's next steps, right under the title. Only what the backend would
 * accept is offered: engineers claim and move their own work, the reporter
 * notes and escalates, and only an admin assigns others or deletes.
 * `onDone(message?)` refreshes the page; `onNote` jumps to the note box.
 */
export default function IncidentActions({ incident, user, canNote, onNote, onDone, onDelete, api }) {
  const [dialog, setDialog] = useState(null)
  const [error, setError] = useState(null)
  const isAdmin = user.role === 'facility_admin'
  const isEngineer = user.role === 'engineer'
  const mine = incident.assigned_to === user.id
  const closed = incident.status === 'Closed'
  const canMove = (isAdmin || (isEngineer && mine)) && TRANSITIONS[incident.status].length > 0
  const canClaim = isEngineer && !incident.assigned_to
  const canEscalate = incident.created_by === user.id && !closed && incident.priority !== 'Critical'

  async function claim() {
    try {
      await api(`/incidents-service/incidents/${incident.id}/assign`, { method: 'POST', body: '{}' })
      setError(null)
      await onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  const done = async (message) => { setDialog(null); await onDone(message) }

  return (
    <div className="actions-bar">
      {canClaim && <button type="button" className="primary" onClick={claim}>Assign to Me</button>}
      {isAdmin && (
        <button type="button" className={incident.assigned_to ? '' : 'primary'} onClick={() => setDialog('assign')}>
          {incident.assigned_to ? 'Reassign Engineer' : 'Assign Engineer'}
        </button>
      )}
      {canMove && <button type="button" className={canClaim ? '' : 'primary'} onClick={() => setDialog('status')}>Change Status</button>}
      {canNote && <button type="button" className={!canMove && !canClaim ? 'primary' : ''} onClick={onNote}>Add Note</button>}
      {canEscalate && <button type="button" onClick={() => setDialog('escalate')}>Escalate</button>}
      {isAdmin && (
        <span className="actions-danger">
          <ConfirmButton label="Delete Incident" title="Delete incident" confirmLabel="Delete incident"
            prompt={`Delete ${incidentId(incident.id)}, "${incident.title}"? Its notes and history go with it. This can't be undone.`}
            onConfirm={onDelete} />
        </span>
      )}
      {error && <p role="alert" className="alert top">{error}</p>}

      {dialog === 'status' && <StatusDialog incident={incident} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'assign' && <AssignDialog incident={incident} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'escalate' && <EscalateDialog incident={incident} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  )
}
