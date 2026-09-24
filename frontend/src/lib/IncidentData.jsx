import { FETCH_LIMIT } from './constants'
import { useFacilities, useIncidents } from './data'
import { IncidentDataContext } from './useIncidentData'

/** Loads what this role may see once, so the header, sidebar and pages share it. */
export function IncidentDataProvider({ children }) {
  const { incidents, error, loaded, reload } = useIncidents(`?limit=${FETCH_LIMIT}`)
  const facilities = useFacilities()
  return (
    <IncidentDataContext.Provider value={{ incidents, error, loaded, reload, facilities }}>
      {children}
    </IncidentDataContext.Provider>
  )
}
