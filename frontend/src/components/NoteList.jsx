import { useState } from 'react'

/** The note thread, plus the box to add one. `onAdd` is absent when you may not. */
export default function NoteList({ notes, onAdd }) {
  const [body, setBody] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!body.trim()) return
    await onAdd(body.trim())
    setBody('')
  }

  return (
    <section className="notes">
      <h4>Notes</h4>
      {notes.length === 0 && <p className="muted">No notes yet.</p>}
      <ul>
        {notes.map((note) => (
          <li key={note.id}>
            <strong>{note.author_name}</strong>
            <time>{new Date(note.created_at).toLocaleString()}</time>
            <p>{note.body}</p>
          </li>
        ))}
      </ul>

      {onAdd && (
        <form onSubmit={submit}>
          <label htmlFor="note-body" className="sr-only">Add a note</label>
          <input
            id="note-body"
            value={body}
            placeholder="Add a note…"
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="submit" disabled={!body.trim()}>Add</button>
        </form>
      )}
    </section>
  )
}
