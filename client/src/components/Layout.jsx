import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth, roleHome } from '../store.jsx'
import { useConfirm } from '../confirm.jsx'
import { closeSocket } from '../socket.js'

const NAV = {
  applicant: [
    { to: '/app', label: 'Dashboard', icon: 'home' },
    { to: '/app/browse', label: 'Browse Jobs', icon: 'search' },
    { to: '/app/applications', label: 'My Applications', icon: 'doc' },
    { to: '/app/resume', label: 'Resume Builder', icon: 'resume' },
    { to: '/app/profile', label: 'My Profile', icon: 'user' }
  ],
  company: [
    { to: '/company', label: 'Dashboard', icon: 'home' },
    { to: '/company/postings/new', label: 'New Posting', icon: 'plus' },
    { to: '/company/applications', label: 'Applications', icon: 'doc' },
    { to: '/company/profile', label: 'Company Profile', icon: 'user' }
  ],
  school: [
    { to: '/school', label: 'My Students', icon: 'home' },
    { to: '/school/profile', label: 'School Profile', icon: 'user' }
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'home' },
    { to: '/admin/profile', label: 'My Profile', icon: 'user' }
  ]
}

function Icon({ name }) {
  const paths = {
    home: 'M3 11.2 12 3.6l7 6V20a1 1 0 0 1-1 1h-4v-6h-4v6H4a1 1 0 0 1-1-1v-8.8Z',
    search: 'M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
    doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M9 13h6M9 17h4',
    resume: 'M12 3a9 9 0 0 0-9 9 8.9 8.9 0 0 0 6 8.4V18h.5A2.5 2.5 0 0 1 12 15.5 2.5 2.5 0 0 1 14.5 18H15v2.4A8.9 8.9 0 0 0 21 12a9 9 0 0 0-9-9Zm-3.5 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    plus: 'M12 5v14M5 12h14',
    pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}

const PROFILE_PATH = {
  applicant: '/app/profile',
  company: '/company/profile',
  school: '/school/profile',
  admin: '/admin/profile'
}

export default function Layout() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  if (!user) return null
  const nav = NAV[user.role] || []

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will need to log in again to manage your account.',
      confirmLabel: 'Sign out'
    })
    if (!ok) return
    closeSocket()
    logout()
    navigate('/login')
  }

  const displayName = user.role === 'company' ? user.profile?.company_name || user.name : user.name
  const subtitle =
    user.role === 'applicant'
      ? `${user.profile?.course || 'Applicant'}${user.profile?.year_level ? ' • ' + user.profile.year_level : ''}`
      : user.role === 'school'
        ? user.profile?.school_name || 'School Coordinator'
        : user.role === 'admin'
          ? 'Administrator'
          : user.profile?.industry || 'Company'

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to={roleHome(user.role)} className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 100 100" width="30" height="30">
              <rect width="100" height="100" rx="22" fill="#fff" />
              <path d="M50 18c11 0 20 8 20 18.4C70 52 50 84 50 84S30 52 30 36.4C30 26 39 18 50 18Z" fill="#FF7A59" />
              <circle cx="50" cy="37" r="9" fill="#5B4BDB" />
            </svg>
          </span>
          <span className="brand-text">
            OJT <em>Connect</em>
          </span>
        </Link>

        <nav className="nav-list">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={['/app', '/company', '/school', '/admin'].includes(item.to)}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <Link to={PROFILE_PATH[user.role] || '/app/profile'} className="mini-user top-user" title="My profile">
            <div className="avatar sm">{user.avatar ? <img src={user.avatar} alt={displayName} /> : displayName.charAt(0).toUpperCase()}</div>
            <div className="mini-user-meta">
              <strong>{displayName}</strong>
              <span>{subtitle}</span>
            </div>
          </Link>
          <button className="link-btn logout-btn" onClick={handleLogout}>
            <Icon name="logout" /> Sign out
          </button>
        </header>
        <Outlet context={{ token: token || undefined }} />
      </main>
    </div>
  )
}