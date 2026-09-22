import { Link, Navigate, Route, Routes } from 'react-router-dom'

import RequireAuth from './components/RequireAuth'
import AdminDashboard from './pages/AdminDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'
import EngineerDashboard from './pages/EngineerDashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import { useAuth } from './useAuth'

// One dashboard per role, and "/" is whichever one you are entitled to.
const HOME = {
  employee: '/my-incidents',
  engineer: '/queue',
  facility_admin: '/admin',
}

function Nav() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <nav>
      <Link className="brand" to={HOME[user.role]}>ACME Facilities</Link>
      <span className="who">{user.full_name} · {user.role.replace('_', ' ')}</span>
      <button onClick={logout}>Log out</button>
    </nav>
  )
}

function Home() {
  const { user } = useAuth()
  return <Navigate to={HOME[user.role] ?? '/login'} replace />
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/my-incidents" element={
          <RequireAuth roles={['employee']}><EmployeeDashboard /></RequireAuth>
        } />
        <Route path="/queue" element={
          <RequireAuth roles={['engineer']}><EngineerDashboard /></RequireAuth>
        } />
        <Route path="/admin" element={
          <RequireAuth roles={['facility_admin']}><AdminDashboard /></RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
