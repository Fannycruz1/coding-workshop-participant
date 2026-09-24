import Icon from './Icon'
import Menu from './Menu'
import { CATEGORIES, PRIORITIES, STATUSES } from '../lib/constants'
import { SORT_CHOICES } from '../lib/incident-fields'

const CREATED = [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']]
const same = (list) => list.map((o) => [o, o])

function Field({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  )
}

/**
 * Search, one Filters popover, one sort, and chips for whatever is narrowing the
 * list. It is controlled: `onChange(name, value)` (or an object of several) goes
 * out and the page keeps the state in the URL. `hide` drops a filter the page
 * already fixes.
 */
export default function IncidentToolbar({ filters, sort, dir, onChange, onClear, people, hide = [], shown, total }) {
  const fields = [
    ['status', 'Status', same(STATUSES)],
    ['category', 'Category', same(CATEGORIES)],
    ['priority', 'Priority', same(PRIORITIES)],
    ['assignee', 'Assignee', people.assignees],
    ['reporter', 'Reporter', people.reporters],
    ['created', 'Date created', CREATED],
  ].filter(([name]) => !hide.includes(name))

  const active = fields.filter(([name]) => filters[name])
  const label = (options, value) => options.find(([v]) => v === value)?.[1] ?? value

  return (
    <div className="toolbar" role="search" aria-label="Filter incidents">
      <div className="search wide">
        <Icon name="search" size={16} />
        <input type="search" aria-label="Search this list" placeholder="Search this list"
          value={filters.q} onChange={(e) => onChange('q', e.target.value)} />
      </div>

      <Menu label="Filters" keepOpen className={`filters-btn${active.length ? ' set' : ''}`} panelClass="filter-panel"
        trigger={<>Filters{active.length > 0 && <span className="count">{active.length}</span>}<Icon name="chevron" size={14} /></>}>
        {fields.map(([name, text, options]) => (
          <Field key={name} label={text} value={filters[name]} options={options} onChange={(v) => onChange(name, v)} />
        ))}
      </Menu>

      <label className="sort">
        <span className="sr-only">Sort</span>
        <select value={`${sort}:${dir}`} onChange={(e) => {
          const [s, d] = e.target.value.split(':')
          onChange({ sort: s, dir: d })
        }}>
          {SORT_CHOICES.map(([s, d, text]) => <option key={`${s}:${d}`} value={`${s}:${d}`}>Sort: {text}</option>)}
        </select>
      </label>

      <span className="toolbar-count" aria-live="polite">{shown} of {total} incidents</span>

      {(active.length > 0 || filters.q) && (
        <div className="chips">
          {active.map(([name, text, options]) => (
            <button key={name} type="button" className="chip" onClick={() => onChange(name, '')}
              aria-label={`Remove ${text} filter`}>
              {text}: <strong>{label(options, filters[name])}</strong> <Icon name="x" size={12} />
            </button>
          ))}
          <button type="button" className="link" onClick={onClear}>Clear filters</button>
        </div>
      )}
    </div>
  )
}
