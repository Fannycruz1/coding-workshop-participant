import { useCallback, useEffect, useState } from 'react'

import NoteList from './NoteList'
import { useApi } from '../api'

/** Loads one incident's notes. `canAdd` mirrors the backend's rule. */
export default function IncidentNotes({ incidentId, canAdd }) {
  const api = useApi()
  const [notes, setNotes] = useState([])
  const [error, setError] = useState(null)

  const reload = useCallback(() => (
    api(`/incidents-service/incidents/${incidentId}/notes`)
      .then((data) => setNotes(data.notes))
      .catch((err) => setError(err.message))
  ), [api, incidentId])

  useEffect(() => { reload() }, [reload])

  const add = async (body) => {
    try {
      await api(`/incidents-service/incidents/${incidentId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      setError(null)
      await reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <NoteList notes={notes} onAdd={canAdd ? add : undefined} />
      {error && <p role="alert">{error}</p>}
    </>
  )
}
