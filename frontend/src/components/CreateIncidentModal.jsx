import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import IncidentForm from './IncidentForm'
import Modal from './Modal'
import { useApi } from '../api'
import { useIncidentData } from '../lib/useIncidentData'

/** Files the incident, then goes straight to its page. */
export default function CreateIncidentModal({ onClose }) {
  const api = useApi()
  const navigate = useNavigate()
  const { facilities, reload } = useIncidentData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function create(body) {
    setBusy(true)
    try {
      const { incident } = await api('/incidents-service/incidents', { method: 'POST', body: JSON.stringify(body) })
      reload()
      onClose()
      navigate(`/incidents/${incident.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Create incident" onClose={onClose}>
      <IncidentForm buildings={facilities.buildings} floors={facilities.floors} seats={facilities.seats}
        onSubmit={create} onCancel={onClose} busy={busy} error={error} />
    </Modal>
  )
}
