import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Administration from './pages/Administration'
import Dashboard from './pages/Dashboard'
import Engineers from './pages/Engineers'
import IncidentDetail from './pages/IncidentDetail'
import { AssignedToMe, Incidents, MyIncidents, Unassigned } from './pages/IncidentQueues'
import Login from './pages/Login'
import Register from './pages/Register'
import Reports from './pages/Reports'

const STAFF = ['engineer', 'facility_admin']
const ADMIN = ['facility_admin']

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incidents" element={<RequireAuth roles={STAFF}><Incidents /></RequireAuth>} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/my-incidents" element={<RequireAuth roles={['employee']}><MyIncidents /></RequireAuth>} />
        <Route path="/assigned" element={<RequireAuth roles={['engineer']}><AssignedToMe /></RequireAuth>} />
        <Route path="/unassigned" element={<RequireAuth roles={STAFF}><Unassigned /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth roles={ADMIN}><Reports /></RequireAuth>} />
        <Route path="/engineers" element={<RequireAuth roles={ADMIN}><Engineers /></RequireAuth>} />
        <Route path="/administration" element={<RequireAuth roles={ADMIN}><Administration /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
