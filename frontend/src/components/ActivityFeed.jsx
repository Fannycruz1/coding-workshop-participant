import { useState } from 'react'

import { parseNote } from '../lib/activity'
import { initials, ROLE_LABELS, whenLabel } from '../lib/format'

const Bold = ({ children }) => <strong>{children}</strong>

/** A structured note (see lib/activity.js) as the sentence it stands for. */
function eventOf(note) {
  const parsed = parseNote(note.body)
  if (!parsed) return { body: note.body }
  if (parsed.kind === 'status') return { action: <>Changed status from <Bold>{parsed.from}</Bold> to <Bold>{parsed.to}</Bold></>, body: parsed.reason, status: parsed.to }
  if (parsed.kind === 'escalation') return { action: <>Requested escalation from <Bold>{parsed.from}</Bold> to <Bold>{parsed.to}</Bold></>, body: parsed.reason }
  return { action: <>{parsed.approved ? 'Approved' : 'Rejected'} the escalation to <Bold>{parsed.to}</Bold></> }
}

/**
 * Who reported it, every note and recorded event, and when it was resolved or
 * closed. Resolved and Closed also come from the incident's own timestamps, so
 * changes made before status notes existed still show, attributed to the system.
 */
function entriesFor(incident, notes, user) {
  const roleOf = (id) => (id === user.id ? ROLE_LABELS[user.role]
    : id === incident.created_by ? 'Employee' : id === incident.assigned_to ? 'Engineer' : 'Staff')

  const events = notes.map((n) => ({ key: `n${n.id}`, who: n.author_name, role: roleOf(n.author_id), at: n.created_at, ...eventOf(n) }))
  const noted = (status) => events.some((e) => e.status === status)

  const entries = [
    { key: 'created', who: incident.reporter_name, role: roleOf(incident.created_by), at: incident.created_at, action: 'Reported this incident' },
    ...events,
  ]
  if (incident.resolved_at && !noted('Resolved')) entries.push({ key: 'resolved', at: incident.resolved_at, action: <>Changed status to <Bold>Resolved</Bold></> })
  if (incident.closed_at && !noted('Closed')) entries.push({ key: 'closed', at: incident.closed_at, action: <>Changed status to <Bold>Closed</Bold></> })
  return entries.sort((a, b) => new Date(a.at) - new Date(b.at))
}

/** Oldest first, like a log, with the note box at the end where the next entry will land. */
export default function ActivityFeed({ incident, notes, user, canNote, onAdd, composer }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    try {
      await onAdd(body.trim())
      setBody('')
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="feed-section" aria-labelledby="activity-title">
      <h2 id="activity-title">Activity</h2>
      <ol className="feed">
        {entriesFor(incident, notes, user).map((e) => (
          <li key={e.key} className={e.who ? '' : 'system'}>
            <span className="avatar small" aria-hidden="true">{e.who ? initials(e.who) : '·'}</span>
            <div>
              <p className="feed-head">
                {e.who ? <><strong>{e.who}</strong> <span className="role">{e.role}</span></> : <span className="role">System</span>}
                <time dateTime={e.at}>{whenLabel(e.at)}</time>
              </p>
              {e.action && <p className="feed-action">{e.action}</p>}
              {e.body && <blockquote>{e.body}</blockquote>}
            </div>
          </li>
        ))}
      </ol>

      {canNote ? (
        <form className="composer" onSubmit={submit}>
          <label htmlFor="note-body">Add a note</label>
          <textarea id="note-body" ref={composer} rows="3" value={body} placeholder="What did you find, or what changed?"
            onChange={(e) => setBody(e.target.value)} />
          {error && <p role="alert" className="alert">{error}</p>}
          <div className="modal-actions">
            <button type="submit" className="primary" disabled={busy || !body.trim()}>Add Note</button>
          </div>
        </form>
      ) : (
        <p className="muted">
          {incident.status === 'Closed' ? 'This incident is closed, so notes can no longer be added.' : 'Only the reporter, the assigned engineer or an admin can add notes.'}
        </p>
      )}
    </section>
  )
}
