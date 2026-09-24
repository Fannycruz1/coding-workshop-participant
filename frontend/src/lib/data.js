import { useCallback, useEffect, useRef, useState } from 'react'

import { useApi } from '../api'

const TABLES = ['buildings', 'floors', 'seats']

const labels = {
  buildings: (b) => b.name,
  floors: (f) => f.name || `Floor ${f.floor_number}`,
  seats: (s) => s.seat_code,
}

/**
 * The three facility lists, fetched whole once per page.
 * They are small, and every dashboard needs them twice over: to fill the
 * report form's dropdowns, and to turn an incident's ids into labels.
 */
export function useFacilities() {
  const api = useApi()
  const [lists, setLists] = useState({ buildings: [], floors: [], seats: [] })

  const reload = useCallback(() => (
    Promise.all(TABLES.map((t) => api(`/facilities-service/${t}`)))
      .then((answers) => setLists(Object.fromEntries(
        TABLES.map((t, i) => [t, answers[i][t]]),
      )))
  ), [api])

  useEffect(() => { reload().catch(() => setLists({ buildings: [], floors: [], seats: [] })) }, [reload])

  const names = Object.fromEntries(TABLES.map((t) => [
    t, Object.fromEntries(lists[t].map((row) => [row.id, labels[t](row)])),
  ]))

  return { ...lists, names, reload }
}

/** The incidents this role may see, narrowed by `query` (from toQuery). */
export function useIncidents(query) {
  const api = useApi()
  const [incidents, setIncidents] = useState([])
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [settled, setSettled] = useState(query)
  const latest = useRef(0)

  // Wait for a pause in typing, so a search doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  // Only the newest request may write, so a slow older response can't overwrite it.
  const reload = useCallback(() => {
    const mine = ++latest.current
    return api(`/incidents-service/incidents${settled}`)
      .then((data) => { if (mine === latest.current) { setIncidents(data.incidents); setError(null); setLoaded(true) } })
      .catch((err) => { if (mine === latest.current) { setError(err.message); setLoaded(true) } })
  }, [api, settled])

  useEffect(() => { reload() }, [reload])

  return { incidents, error, loaded, reload }
}
