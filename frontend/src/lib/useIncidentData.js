import { createContext, useContext } from 'react'

export const IncidentDataContext = createContext(null)

export const useIncidentData = () => useContext(IncidentDataContext)
