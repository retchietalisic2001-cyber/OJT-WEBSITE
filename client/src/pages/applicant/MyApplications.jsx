import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, StatusBadge, emptyState } from '../../components/ui.jsx'

export default function MyApplications() {
  const { token } = useAuth()
  const [apps, setApps] = useState(null)

  useEffect(() => {
    api('/applications/my', { token }).then(setApps).catch(() => setApps([]))
  }, [token])

  if (!apps) return <Spinner />

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>My Applications</h1>
          <p className="muted">Track every application from here — status updates and chats live in each application.</p>
        </div>
      </header>

      {apps.length === 0 ? (
        <div className="card card-pad">
          {emptyState(
            'No applications yet',
            'Browse openings and apply — your applications will appear here with live status tracking.',
            <Link className="btn btn-primary" to="/app/browse">Browse openings</Link>
          )}
        </div>
      ) : (
        <div className="app-list">
          {apps.map((a) => (
            <Link key={a.id} to={`/app/applications/${a.id}`} className="card app-row">
              <div className="app-row-main">
                <div className="job-logo">{a.company_logo ? <img src={a.company_logo} alt={a.company_name} /> : a.company_name?.charAt(0).toUpperCase()}</div>
                <div>
                  <h3>{a.posting_title}</h3>
                  <span className="muted">{a.company_name}{a.city ? ` — ${a.city}` : ''}</span>
                </div>
              </div>
              <div className="app-row-side">
                <StatusBadge status={a.status} />
                {a.unread_count > 0 && (
                  <span className="unread-badge">{a.unread_count} new</span>
                )}
                <span className="muted small">Updated {fmtDate(a.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}