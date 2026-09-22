import { useState } from 'react'

import { CATEGORIES, PRIORITIES } from '../lib/constants'
import { validate } from '../lib/incident-fields'

const EMPTY = {
  title: '', description: '', category: '', priority: 'Medium',
  building_id: '', floor_id: '', seat_id: '',
}

export default function IncidentForm({ buildings, floors, seats, onSubmit, busy }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  // The three lists are fetched whole once, so narrowing is a filter, not a request.
  const ourFloors = floors.filter((f) => String(f.building_id) === values.building_id)
  const ourSeats = seats.filter((s) => String(s.floor_id) === values.floor_id)

  const set = (name) => (event) => {
    const value = event.target.value
    setValues((prev) => ({
      ...prev,
      [name]: value,
      // A floor from the old building would be a foreign-key error at the API.
      ...(name === 'building_id' && { floor_id: '', seat_id: '' }),
      ...(name === 'floor_id' && { seat_id: '' }),
    }))
  }

  function submit(event) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) return

    onSubmit({
      title: values.title.trim(),
      description: values.description.trim() || null,
      category: values.category,
      priority: values.priority,
      building_id: Number(values.building_id),
      floor_id: Number(values.floor_id),
      seat_id: values.seat_id ? Number(values.seat_id) : null,
    })
    setValues(EMPTY)
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h3>Report an incident</h3>

      <label htmlFor="title">Title</label>
      <input id="title" value={values.title} onChange={set('title')} />

      <label htmlFor="description">Description</label>
      <textarea id="description" rows="3" value={values.description} onChange={set('description')} />

      <div className="row">
        <div>
          <label htmlFor="category">Category</label>
          <select id="category" value={values.category} onChange={set('category')}>
            <option value="">Choose…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="priority">Priority</label>
          <select id="priority" value={values.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor="building_id">Building</label>
          <select id="building_id" value={values.building_id} onChange={set('building_id')}>
            <option value="">Choose…</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="floor_id">Floor</label>
          <select id="floor_id" value={values.floor_id} onChange={set('floor_id')} disabled={!values.building_id}>
            <option value="">Choose…</option>
            {ourFloors.map((f) => (
              <option key={f.id} value={f.id}>{f.name || `Floor ${f.floor_number}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="seat_id">Seat (optional)</label>
          <select id="seat_id" value={values.seat_id} onChange={set('seat_id')} disabled={!values.floor_id}>
            <option value="">None</option>
            {ourSeats.map((s) => <option key={s.id} value={s.id}>{s.seat_code}</option>)}
          </select>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <p role="alert">{Object.values(errors).join(' · ')}</p>
      )}

      <button type="submit" disabled={busy}>{busy ? 'Reporting…' : 'Report incident'}</button>
    </form>
  )
}
