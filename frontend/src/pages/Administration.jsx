import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import PageHeader from '../components/PageHeader'
import Tabs from '../components/Tabs'
import { useApi } from '../api'
import { decisionNote } from '../lib/activity'
import { incidentId, shortDate } from '../lib/format'
import { useIncidentData } from '../lib/useIncidentData'
import FacilityTab from './FacilityTab'

const TABS = ['Escalations', 'Buildings', 'Floors', 'Seats']

// --- escalations -----------------------------------------------------------

function Escalations() {
  const api = useApi()
  const { incidents, reload: reloadIncidents } = useIncidentData()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(() => (
    api('/incidents-service/escalations?status=Pending')
      .then((d) => setRows(d.escalations))
      .catch((err) => { setRows([]); setError(err.message) })
  ), [api])
  useEffect(() => { reload() }, [reload])

  async function decide(row, approved) {
    try {
      await api(`/incidents-service/escalations/${row.id}/decide`, {
        method: 'POST', body: JSON.stringify({ decision: approved ? 'approve' : 'reject' }),
      })
      // Leave the decision in the incident's own activity, best effort.
      await api(`/incidents-service/incidents/${row.incident_id}/notes`, {
        method: 'POST', body: JSON.stringify({ body: decisionNote(approved, row.requested_priority) }),
      }).catch(() => {})
      setError(null)
      await Promise.all([reload(), reloadIncidents()])
    } catch (err) {
      setError(err.message)
    }
  }

  const titleOf = (id) => incidents.find((i) => i.id === id)

  return (
    <>
      {error && <p role="alert" className="alert">{error}</p>}
      <div className="table-wrap">
        <table className="incidents static">
          <thead><tr>{['Incident', 'Priority change', 'Reason', 'Requested by', 'Requested', ''].map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
          <tbody>
            {!rows && <tr className="skeleton" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <td key={i}><span /></td>)}</tr>}
            {rows?.length === 0 && <tr><td colSpan="6" className="empty">No escalations are waiting on a decision.</td></tr>}
            {rows?.map((row) => (
              <tr key={row.id}>
                <td className="title"><Link to={`/incidents/${row.incident_id}`}><span className="id">{incidentId(row.incident_id)}</span> {titleOf(row.incident_id)?.title}</Link></td>
                <td>{row.current_priority} to <strong>{row.requested_priority}</strong></td>
                <td className="reason">{row.reason}</td>
                <td>{titleOf(row.incident_id)?.reporter_name ?? '—'}</td>
                <td className="date">{shortDate(row.created_at)}</td>
                <td className="act">
                  <button type="button" className="primary small" onClick={() => decide(row, true)}>Approve</button>{' '}
                  <button type="button" className="small" onClick={() => decide(row, false)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function Administration() {
  const [tab, setTab] = useState('Escalations')

  return (
    <>
      <PageHeader title="Administration" subtitle="Decide escalations and keep buildings, floors and seats current." />
      <Tabs tabs={TABS} value={tab} onChange={setTab}>
        {tab === 'Escalations' ? <Escalations /> : <FacilityTab table={tab.toLowerCase()} />}
      </Tabs>
    </>
  )
}
