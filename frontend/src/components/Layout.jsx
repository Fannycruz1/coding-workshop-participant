import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import CreateIncidentModal from './CreateIncidentModal'
import Icon from './Icon'
import Menu from './Menu'
import { IncidentDataProvider } from '../lib/IncidentData'
import { initials, listPath, ROLE_LABELS } from '../lib/format'
import { isUnassigned } from '../lib/incident-fields'
import { notificationsFor } from '../lib/notifications'
import { useIncidentData } from '../lib/useIncidentData'
import { useAuth } from '../useAuth'

const ALL = ['employee', 'engineer', 'facility_admin']
const STAFF = ['engineer', 'facility_admin']
const ADMIN = ['facility_admin']

// [label, path, icon, roles, count]. Some items only make sense for some roles.
const NAV = [
  ['Dashboard', '/', 'dashboard', ALL],
  ['Incidents', '/incidents', 'list', STAFF],
  ['My Incidents', '/my-incidents', 'user', ['employee']],
  ['Assigned to Me', '/assigned', 'wrench', ['engineer'], 'assigned'],
  ['Unassigned', '/unassigned', 'inbox', STAFF, 'unassigned'],
  ['Reports', '/reports', 'chart', ADMIN],
  ['Engineers', '/engineers', 'users', ADMIN],
  ['Administration', '/administration', 'gear', ADMIN],
]

function UserMenu() {
  const { user, logout } = useAuth()
  return (
    <Menu label="Account menu" className="user-trigger" panelClass="up"
      trigger={(
        <>
          <span className="avatar">{initials(user.full_name)}</span>
          <span className="who">
            <strong>{user.full_name}</strong>
            <small>{ROLE_LABELS[user.role]}</small>
          </span>
          <Icon name="chevron" size={16} />
        </>
      )}>
      <div className="menu-head"><strong>{user.full_name}</strong><small>{user.email}</small></div>
      <button type="button" className="menu-item" onClick={logout}><Icon name="logout" size={16} /> Log out</button>
    </Menu>
  )
}

function Notifications() {
  const { user } = useAuth()
  const { incidents } = useIncidentData()
  const items = notificationsFor(user, incidents)
  return (
    <Menu label={`Notifications, ${items.length} new`} className="icon-btn" panelClass="right wide"
      trigger={<><Icon name="bell" />{items.length > 0 && <span className="dot">{items.length}</span>}</>}>
      <div className="menu-head"><strong>Needs attention</strong></div>
      {items.length === 0 && <p className="menu-empty">Nothing needs you right now.</p>}
      {items.map((n) => <Link key={n.id} to={n.to} className="menu-item">{n.text}</Link>)}
    </Menu>
  )
}

function Header({ onMenu, onCreate }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  function search(event) {
    event.preventDefault()
    const q = new FormData(event.currentTarget).get('q').trim()
    navigate(`${listPath(user.role)}${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-btn" aria-label="Open navigation" onClick={onMenu}><Icon name="menu" /></button>
      <form className="search" role="search" onSubmit={search}>
        <Icon name="search" size={16} />
        <input name="q" type="search" aria-label="Search incidents"
          placeholder="Search by ID, title, category, reporter or engineer" />
      </form>
      <div className="topbar-actions">
        {user.role !== 'engineer' && (
          <button type="button" className="primary" onClick={onCreate}><Icon name="plus" size={16} /> Create Incident</button>
        )}
        <Notifications />
      </div>
    </header>
  )
}

function Sidebar({ open, onNavigate, collapsed, onToggle }) {
  const { user } = useAuth()
  const { incidents } = useIncidentData()
  const counts = {
    unassigned: incidents.filter(isUnassigned).length,
    assigned: incidents.filter((i) => i.assigned_to === user.id && i.status !== 'Closed').length,
  }

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-head">
        <Link to="/" className="brand" onClick={onNavigate}>
          <span className="brand-mark">A</span>
          <span className="brand-text"><strong>ACME</strong><small>Facility Incident Management</small></span>
        </Link>
        <button type="button" className="icon-btn collapse-btn" onClick={onToggle} aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Icon name="sidebar" />
        </button>
      </div>
      <nav aria-label="Main">
        {NAV.filter(([, , , roles]) => roles.includes(user.role)).map(([label, to, icon, , count]) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} title={label}>
            <Icon name={icon} />
            <span className="nav-label">{label}</span>
            {count && counts[count] > 0 && <span className="count">{counts[count]}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot"><UserMenu /></div>
    </aside>
  )
}

const COLLAPSED_KEY = 'sidebar-collapsed'

// Storage can be blocked or empty (private windows), so both directions are guarded.
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false } }

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [creating, setCreating] = useState(false)
  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /* the choice just won't persist */ }
  }

  return (
    <IncidentDataProvider>
      <a className="skip" href="#content">Skip to content</a>
      <div className={`shell${collapsed ? ' collapsed' : ''}`}>
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} collapsed={collapsed} onToggle={toggleCollapsed} />
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
        <div className="content-col">
          <Header onMenu={() => setNavOpen(true)} onCreate={() => setCreating(true)} />
          <main id="content"><Outlet /></main>
        </div>
      </div>
      {creating && <CreateIncidentModal onClose={() => setCreating(false)} />}
    </IncidentDataProvider>
  )
}
