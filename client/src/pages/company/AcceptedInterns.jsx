import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, StatusBadge, emptyState } from '../../components/ui.jsx'

export default function AcceptedInterns() {
  const { token } = useAuth()
  const [apps, setApps] = useState(null)

  useEffect(() => {
    api('/applications/company', { token }).then(setApps).catch(() => setApps([]))
  }, [token])

  if (!apps) return <Spinner />

  const accepted = apps.filter((a) => a.status === 'accepted')

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>🎓 Accepted Interns</h1>
          <p className="muted">
            The OJT applicants your company has accepted{accepted.length ? ` — ${accepted.length} total` : ''}.
          </p>
        </div>
      </header>

      {accepted.length === 0 ? (
        <div className="card card-pad">
          {emptyState(
            'No accepted interns yet',
            'Applicants you accept from your postings will appear here so you can keep track of your OJT participants.',
            <Link className="btn btn-primary" to="/company">Go to dashboard</Link>
          )}
        </div>
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Intern</th>
                <th>Course / School</th>
                <th>Posting</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {accepted.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="cell-user">
                      <div className="avatar sm">{a.applicant_name?.charAt(0).toUpperCase()}</div>
                      <div>
                        <strong>{a.applicant_name}</strong>
                        <span className="muted small">{a.applicant_email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <b>{a.course || '—'}</b>
                    <span className="muted small d-block">{a.school_name || 'No school'}</span>
                  </td>
                  <td>
                    {a.posting_title}
                    {a.city ? <span className="muted small d-block">{a.city}</span> : null}
                  </td>
                  <td>
                    <StatusBadge status={a.status} />
                    <span className="muted small d-block">Accepted {fmtDate(a.updated_at)}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link className="btn btn-ghost btn-sm" to={`/company/applications/${a.id}`}>Open →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}