import { useCallback, useEffect, useState } from 'react'

import ConfirmButton from '../components/ConfirmButton'
import DialogForm from '../components/DialogForm'
import PageHeader from '../components/PageHeader'
import { useApi } from '../api'
import { CATEGORIES } from '../lib/constants'
import { isLive } from '../lib/incident-fields'
import { useIncidentData } from '../lib/useIncidentData'
import { useSubmit } from '../lib/useSubmit'

/** Create when there is no `engineer`, edit specialty and phone when there is. */
function EngineerDialog({ engineer, onClose, onDone }) {
  const api = useApi()
  const { error, busy, submit } = useSubmit((f) => {
    const fields = Object.fromEntries([...f].filter(([, v]) => v !== ''))
    return engineer
      ? api(`/auth-service/engineers/${engineer.id}`, { method: 'PATCH', body: JSON.stringify({ specialty: fields.specialty, phone: f.get('phone') || null }) })
      : api('/auth-service/engineers', { method: 'POST', body: JSON.stringify(fields) })
  }, onDone)

  return (
    <DialogForm title={engineer ? `Edit ${engineer.full_name}` : 'Add engineer'} onClose={onClose}
      submit={submit} error={error} busy={busy} confirm={engineer ? 'Save changes' : 'Add engineer'}>
      {!engineer && (
        <>
          <label htmlFor="eng-name">Full name</label>
          <input id="eng-name" name="full_name" required />
          <label htmlFor="eng-email">Email</label>
          <input id="eng-email" name="email" type="email" placeholder="name@acme.inc" required />
          <label htmlFor="eng-password">Temporary password</label>
          <input id="eng-password" name="password" type="password" autoComplete="new-password" required />
        </>
      )}
      <label htmlFor="eng-specialty">Specialty</label>
      <select id="eng-specialty" name="specialty" defaultValue={engineer?.specialty ?? 'HVAC'}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <label htmlFor="eng-phone">Phone (optional)</label>
      <input id="eng-phone" name="phone" defaultValue={engineer?.phone ?? ''} />
    </DialogForm>
  )
}

export default function Engineers() {
  const api = useApi()
  const { incidents, loaded } = useIncidentData()
  const [engineers, setEngineers] = useState(null)
  const [dialog, setDialog] = useState(null) // 'new', or the engineer being edited
  const [error, setError] = useState(null)

  const reload = useCallback(() => (
    api('/auth-service/engineers').then((d) => setEngineers(d.engineers)).catch((err) => { setEngineers([]); setError(err.message) })
  ), [api])
  useEffect(() => { reload() }, [reload])

  async function deactivate(engineer) {
    try {
      await api(`/auth-service/engineers/${engineer.id}`, { method: 'DELETE' })
      setError(null)
      await reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const mine = (e) => incidents.filter((i) => i.assigned_to === e.id)
  const done = async () => { setDialog(null); await reload() }

  return (
    <>
      <PageHeader title="Engineers" subtitle="Who can be assigned work, and how much each is carrying.">
        <button type="button" className="primary" onClick={() => setDialog('new')}>Add Engineer</button>
      </PageHeader>
      {error && <p role="alert" className="alert">{error}</p>}

      <div className="table-wrap">
        <table className="incidents static">
          <thead>
            <tr>{['Name', 'Email', 'Specialty', 'Active Status', 'Assigned Incidents', 'Open Incidents', 'Resolved Incidents', ''].map((c, i) => <th key={i} scope="col" className={i >= 4 && i < 7 ? 'num' : undefined}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {!(engineers && loaded) && <tr className="skeleton" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <td key={i}><span /></td>)}</tr>}
            {engineers && loaded && engineers.length === 0 && <tr><td colSpan="8" className="empty">No engineers yet. Create one so incidents can be assigned.</td></tr>}
            {engineers && loaded && engineers.map((e) => (
              <tr key={e.id}>
                <td className="title"><strong>{e.full_name}</strong></td>
                <td>{e.email}</td>
                <td>{e.specialty}</td>
                <td><span className="badge" data-status="Resolved">{e.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="num">{mine(e).filter((i) => i.status !== 'Closed').length}</td>
                <td className="num">{mine(e).filter(isLive).length}</td>
                <td className="num">{mine(e).filter((i) => i.status === 'Resolved').length}</td>
                <td className="act">
                  <button type="button" className="small" onClick={() => setDialog(e)}>Edit</button>{' '}
                  <ConfirmButton small label="Deactivate" title={`Deactivate ${e.full_name}`}
                    prompt={`Deactivate ${e.full_name}? Their account is switched off and their open incidents go back to the unassigned pool.`}
                    onConfirm={() => deactivate(e)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && <EngineerDialog engineer={dialog === 'new' ? null : dialog} onClose={() => setDialog(null)} onDone={done} />}
    </>
  )
}
