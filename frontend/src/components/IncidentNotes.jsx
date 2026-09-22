import { useCallback, useEffect, useState } from 'react'

import NoteList from './NoteList'
import { useApi } from '../api'

/**
 * One incident's notes, fetched only once the thread is opened.
 *
 * A dashboard shows a list of cards, so loading eagerly meant one request per
 * card the moment the page rendered — fifty of them, for threads nobody had
 * asked to see. <details> is the browser's own disclosure widget; all this
 * adds is not mounting the list until it opens.
 */
export default function IncidentNotes({ incidentId, canAdd }) {
  const api = useApi()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState([])
  const [error, setError] = useState(null)

  const reload = useCallback(() => (
    api(`/incidents-service/incidents/${incidentId}/notes`)
      .then((data) => setNotes(data.notes))
      .catch((err) => setError(err.message))
  ), [api, incidentId])

  useEffect(() => { if (open) reload() }, [open, reload])

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
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Notes</summary>
      {open && <NoteList notes={notes} onAdd={canAdd ? add : undefined} />}
      {error && <p role="alert">{error}</p>}
    </details>
  )
}
