import { CATEGORIES, PRIORITIES, STATUSES } from '../lib/constants'

const FIELDS = [
  ['status', 'Status', STATUSES],
  ['category', 'Category', CATEGORIES],
  ['priority', 'Priority', PRIORITIES],
]

export default function IncidentFilters({ value, onChange }) {
  // Report the whole set, not the one that changed: the caller holds the state.
  const set = (name) => (event) => onChange({ ...value, [name]: event.target.value })

  return (
    <div className="filters">
      {FIELDS.map(([name, label, options]) => (
        <label key={name}>
          {label}
          <select aria-label={label} value={value[name] ?? ''} onChange={set(name)}>
            <option value="">Any</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      ))}
      <label>
        Search
        <input
          aria-label="Search"
          type="search"
          placeholder="title or description"
          value={value.q ?? ''}
          onChange={set('q')}
        />
      </label>
    </div>
  )
}
