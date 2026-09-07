import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, StatusBadge, emptyState } from '../../components/ui.jsx'

export default function CompanyApplications() {
  const { token } = useAuth()
  const [apps, setApps] = useState(null)

  useEffect(() => {
    api('/applications/company', { token }).then(setApps).catch(() => setApps([]))
  }, [token])

  if (!apps) return <Spinner />

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Applications</h1>
          <p className="muted">All applicants across your postings, newest first.</p>
        </div>
      </header>

      {apps.length === 0 ? (
        <div className="card card-pad">
          {emptyState('No applications yet', 'When applicants respond to your postings they will show up here.', <Link className="btn btn-primary" to="/company/postings/new">New posting</Link>)}
        </div>
      ) : (
        <div className="app-list">
          {apps.map((a) => (
            <Link key={a.id} to={`/company/applications/${a.id}`} className="card app-row">
              <div className="app-row-main">
                <div className="job-logo">{a.applicant_name?.charAt(0).toUpperCase()}</div>
                <div>
                  <h3>{a.applicant_name}</h3>
                  <span className="muted">{a.posting_title} · {a.course || 'No course'}</span>
                </div>
              </div>
              <div className="app-row-side">
                <StatusBadge status={a.status} />
                <span className="muted small">Applied {fmtDate(a.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}