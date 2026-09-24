import { useState } from 'react'

import { CATEGORIES, PRIORITIES } from '../lib/constants'
import { validate } from '../lib/incident-fields'

const EMPTY = {
  title: '', description: '', category: '', priority: 'Medium',
  building_id: '', floor_id: '', seat_id: '',
}

const FieldError = ({ id, message }) => (
  message ? <small id={`${id}-error`} className="field-error">{message}</small> : null
)

/** The report form. The reporter is never asked for: the server takes it from the session. */
export default function IncidentForm({ buildings, floors, seats, onSubmit, onCancel, busy, error }) {
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

  const invalid = (name) => ({
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  })

  function submit(event) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found)[0])?.focus()
      return
    }

    onSubmit({
      title: values.title.trim(),
      description: values.description.trim() || null,
      category: values.category,
      priority: values.priority,
      building_id: Number(values.building_id),
      floor_id: Number(values.floor_id),
      seat_id: values.seat_id ? Number(values.seat_id) : null,
    })
  }

  return (
    <form className="stack form" onSubmit={submit} noValidate>
      <label htmlFor="title">Title</label>
      <input id="title" placeholder="A short description of the problem" {...invalid('title')} value={values.title} onChange={set('title')} />
      <FieldError id="title" message={errors.title} />

      <label htmlFor="description">Description</label>
      <textarea id="description" rows="4" placeholder="What is happening, and what is affected?" value={values.description} onChange={set('description')} />

      <div className="row">
        <div>
          <label htmlFor="category">Category</label>
          <select id="category" {...invalid('category')} value={values.category} onChange={set('category')}>
            <option value="">Choose…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <FieldError id="category" message={errors.category} />
        </div>
        <div>
          <label htmlFor="priority">Priority</label>
          <select id="priority" value={values.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <fieldset>
        <legend>Location</legend>
        <div className="row">
          <div>
            <label htmlFor="building_id">Building</label>
            <select id="building_id" {...invalid('building_id')} value={values.building_id} onChange={set('building_id')}>
              <option value="">Choose…</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <FieldError id="building_id" message={errors.building_id} />
          </div>
          <div>
            <label htmlFor="floor_id">Floor</label>
            <select id="floor_id" {...invalid('floor_id')} value={values.floor_id} onChange={set('floor_id')} disabled={!values.building_id}>
              <option value="">{!values.building_id ? 'Pick a building first' : ourFloors.length ? 'Choose…' : 'No floors listed'}</option>
              {ourFloors.map((f) => <option key={f.id} value={f.id}>{f.name || `Floor ${f.floor_number}`}</option>)}
            </select>
            <FieldError id="floor_id" message={errors.floor_id} />
          </div>
          <div>
            <label htmlFor="seat_id">Seat (optional)</label>
            <select id="seat_id" value={values.seat_id} onChange={set('seat_id')} disabled={!values.floor_id}>
              <option value="">{!values.floor_id ? 'Pick a floor first' : 'None'}</option>
              {ourSeats.map((s) => <option key={s.id} value={s.id}>{s.seat_code}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      {Object.keys(errors).length > 0 && <p role="alert" className="alert">Please fix the highlighted fields.</p>}
      {error && <p role="alert" className="alert">{error}</p>}

      <div className="modal-actions">
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create Incident'}</button>
      </div>
    </form>
  )
}
