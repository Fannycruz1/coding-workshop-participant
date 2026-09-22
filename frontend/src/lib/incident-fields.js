// The two pure bits of the incident UI: what the filters send, and what the
// form insists on. Out of the components so both stay testable on their own.

/** Drops the filters that aren't set and builds the query string for GET /incidents. */
export function toQuery(filters) {
  const set = Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  const params = new URLSearchParams(set)
  return params.toString() ? `?${params}` : ''
}

/** The same four required fields the backend's IncidentCreate model demands. */
export function validate(values) {
  const errors = {}
  if (!values.title?.trim()) errors.title = 'a title is required'
  if (!values.category) errors.category = 'pick a category'
  if (!values.building_id) errors.building_id = 'pick a building'
  if (!values.floor_id) errors.floor_id = 'pick a floor'
  return errors
}
