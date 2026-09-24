import { useState } from 'react'

import ConfirmButton from '../components/ConfirmButton'
import DialogForm from '../components/DialogForm'
import { useApi } from '../api'
import { useIncidentData } from '../lib/useIncidentData'
import { useSubmit } from '../lib/useSubmit'

// One spec per table, the same shape the facilities service stores.
const SPEC = {
  buildings: {
    noun: 'building', removes: 'its floors and seats',
    fields: [{ name: 'name', label: 'Name', required: true }, { name: 'address', label: 'Address' }],
  },
  floors: {
    noun: 'floor', removes: 'its seats',
    fields: [
      { name: 'building_id', label: 'Building', parent: 'buildings', required: true },
      { name: 'floor_number', label: 'Floor number', type: 'number', required: true },
      { name: 'name', label: 'Name (optional)' },
    ],
  },
  seats: {
    noun: 'seat', removes: 'nothing else',
    fields: [
      { name: 'floor_id', label: 'Floor', parent: 'floors', required: true },
      { name: 'seat_code', label: 'Seat code', required: true },
    ],
  },
}

const HEADINGS = {
  buildings: ['Name', 'Address', 'Floors', 'Incidents'],
  floors: ['Building', 'Floor', 'Name', 'Seats', 'Incidents'],
  seats: ['Building', 'Floor', 'Seat', 'Incidents'],
}

const collator = new Intl.Collator('en', { numeric: true })

function AddDialog({ table, options, onClose, onDone }) {
  const api = useApi()
  const spec = SPEC[table]
  const { error, busy, submit } = useSubmit((data) => {
    const body = {}
    for (const field of spec.fields) {
      const value = data.get(field.name)
      if (value === '' || value === null) continue
      body[field.name] = field.type === 'number' || field.parent ? Number(value) : value
    }
    return api(`/facilities-service/${table}`, { method: 'POST', body: JSON.stringify(body) })
  }, onDone)

  return (
    <DialogForm title={`Add ${spec.noun}`} onClose={onClose} submit={submit} error={error} busy={busy} confirm={`Add ${spec.noun}`}>
      {spec.fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={`add-${f.name}`}>{f.label}</label>
          {f.parent ? (
            <select id={`add-${f.name}`} name={f.name} required>
              <option value="">Choose…</option>
              {options[f.parent].map(([id, text]) => <option key={id} value={id}>{text}</option>)}
            </select>
          ) : (
            <input id={`add-${f.name}`} name={f.name} type={f.type || 'text'} required={f.required} />
          )}
        </div>
      ))}
    </DialogForm>
  )
}

/** One facility table as its own Administration tab: list, add, delete, with the incident count that can block a delete. */
export default function FacilityTab({ table }) {
  const api = useApi()
  const { facilities, incidents } = useIncidentData()
  const { buildings, floors, seats, names } = facilities
  const [building, setBuilding] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const spec = SPEC[table]

  const floorOf = (id) => floors.find((f) => f.id === id)
  const buildingName = (id) => names.buildings[id] ?? '—'
  const uses = (key, id) => incidents.filter((i) => i[key] === id).length

  const rows = {
    buildings: buildings.map((b) => ({
      id: b.id, sort: b.name,
      cells: [<strong key="n">{b.name}</strong>, b.address || '—', floors.filter((f) => f.building_id === b.id).length, uses('building_id', b.id)],
      label: b.name,
    })),
    floors: floors.filter((f) => !building || String(f.building_id) === building).map((f) => ({
      id: f.id, sort: `${buildingName(f.building_id)}\u0000${String(f.floor_number).padStart(4, '0')}`,
      cells: [buildingName(f.building_id), f.floor_number, f.name || '—', seats.filter((s) => s.floor_id === f.id).length, uses('floor_id', f.id)],
      label: `${buildingName(f.building_id)}, ${names.floors[f.id]}`,
    })),
    seats: seats.filter((s) => !building || String(floorOf(s.floor_id)?.building_id) === building).map((s) => {
      const f = floorOf(s.floor_id)
      return {
        id: s.id, sort: `${buildingName(f?.building_id)}\u0000${String(f?.floor_number).padStart(4, '0')}\u0000${s.seat_code}`,
        cells: [buildingName(f?.building_id), f?.floor_number, s.seat_code, uses('seat_id', s.id)],
        label: `seat ${s.seat_code}`,
      }
    }),
  }[table].sort((a, b) => collator.compare(a.sort, b.sort))

  const options = {
    buildings: buildings.map((b) => [b.id, b.name]),
    floors: [...floors].sort((a, b) => collator.compare(`${buildingName(a.building_id)}${a.floor_number}`, `${buildingName(b.building_id)}${b.floor_number}`))
      .map((f) => [f.id, `${buildingName(f.building_id)} · ${names.floors[f.id]}`]),
  }

  async function remove(row) {
    try {
      await api(`/facilities-service/${table}/${row.id}`, { method: 'DELETE' })
      setError(null)
      await facilities.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const numeric = (i) => i >= HEADINGS[table].length - (table === 'buildings' ? 2 : table === 'floors' ? 2 : 1)
  const columns = HEADINGS[table].length + 1

  return (
    <>
      <div className="tab-toolbar">
        {table !== 'buildings' && (
          <label className="inline-filter">
            <span className="sr-only">Filter by building</span>
            <select value={building} onChange={(e) => setBuilding(e.target.value)}>
              <option value="">All buildings</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
        <span className="toolbar-count">{rows.length} {rows.length === 1 ? spec.noun : `${spec.noun}s`}</span>
        <button type="button" className="primary" onClick={() => setAdding(true)}>Add {spec.noun}</button>
      </div>

      {error && <p role="alert" className="alert">{error}</p>}

      <div className="table-wrap">
        <table className="incidents static">
          <thead><tr>{[...HEADINGS[table], ''].map((c, i) => <th key={i} scope="col" className={numeric(i) && c ? 'num' : undefined}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns} className="empty">No {spec.noun}s yet. Use <strong>Add {spec.noun}</strong> to create one.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, i) => <td key={i} className={numeric(i) ? 'num' : undefined}>{cell}</td>)}
                <td className="act">
                  <ConfirmButton small label="Delete" title={`Delete ${spec.noun}`}
                    prompt={`Delete ${row.label}? This also removes ${spec.removes}. It can't be deleted while incidents use it.`}
                    onConfirm={() => remove(row)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && <AddDialog table={table} options={options} onClose={() => setAdding(false)}
        onDone={async () => { setAdding(false); await facilities.reload() }} />}
    </>
  )
}
