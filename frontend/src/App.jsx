import { Navigate, Route, Routes } from 'react-router-dom'

import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import { useAuth } from './useAuth'

// Placeholder for the real dashboards (Phase 5). It exists so this phase's
// milestone — a real login round-trip through the Lambda and DB — is visible.
function Home() {
  const { user, logout } = useAuth()
  return (
    <main>
      <h1>Signed in</h1>
      <p>{user.full_name} ({user.email}) — {user.role}</p>
      <button onClick={logout}>Log out</button>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
