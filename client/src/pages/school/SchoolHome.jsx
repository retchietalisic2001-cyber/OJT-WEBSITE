import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api } from '../../api.js'
import { Spinner, StatusBadge, StatCard, emptyState } from '../../components/ui.jsx'

export default function SchoolHome() {
  const { token, user } = useAuth()
  const [data, setData] = useState(null)
  const [verify, setVerify] = useState(null)

  useEffect(() => {
    api('/schools/stats', { token }).then(setData).catch(() => setData({ error: true }))
    api('/verify/status', { token }).then(setVerify).catch(() => {})
  }, [token])

  if (!data) return <Spinner />

  const blockTracking = verify && !verify.verified && verify.pendingCount === 0
  if (blockTracking) {
    return (
      <div className="page">
        <div className="card card-pad">
          {emptyState(
            '🔒 Verification required',
            "Your school must be verified to track students' OJT progress. Upload a valid ID and your school credentials/papers (CHED permit, registration) on your profile.",
            <Link className="btn btn-primary" to="/school/profile">Go to verification</Link>
          )}
        </div>
      </div>
    )
  }

  if (data.error) return <div className="card card-pad">{emptyState('No school linked', 'Link your school in your profile so you can monitor its students.', <Link className="btn btn-primary" to="/school/profile">Link my school</Link>)}</div>

  const s = data
  const unverified = verify ? !verify.verified : false
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{user.profile?.school_name || 'School'} · OJT monitoring</h1>
          <p className="muted">See which students have found companies and help those who have not yet applied.</p>
        </div>
      </header>

      {unverified && (
        <div className="verify-banner unverified">
          ⚠️ Your school account isn't verified yet. Upload a valid ID and your school credentials/papers (CHED permit, registration)
          on your <Link className="link-btn" to="/school/profile">profile</Link> to confirm this school is legitimate.
        </div>
      )}

      <div className="stats-grid">
        <StatCard icon="🧑‍🎓" label="Students tracked" value={s.total_students} accent="#5B4BDB" />
        <StatCard icon="✅" label="Found a company" value={s.with_application} accent="#2FA86B" />
        <StatCard icon="🕐" label="Not yet applied" value={s.without_application} accent="#D97706" />
        <StatCard icon="🎉" label="Placed (accepted)" value={s.placed} accent="#2F80ED" />
      </div>

      <div className="stats-grid alt">
        <div className="card card-pad mini-stat">
          <h3>In progress</h3>
          <b>{s.in_progress}</b>
          <span className="muted small">submitted · review · interview</span>
        </div>
        <div className="card card-pad mini-stat">
          <h3>Under review</h3>
          <b>{s.status_counts.under_review}</b>
        </div>
        <div className="card card-pad mini-stat">
          <h3>Interviews</h3>
          <b>{s.status_counts.interview}</b>
        </div>
        <div className="card card-pad mini-stat">
          <h3>Rejected</h3>
          <b>{s.status_counts.rejected}</b>
        </div>
      </div>

      <section className="mt">
        <div className="section-head">
          <h2>All {s.school_name ? `students of ${s.school_name}` : ''}</h2>
          <span className="muted">{s.students.length} students</span>
        </div>
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Applications</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {s.students.map((st) => (
                <tr key={st.id}>
                  <td>
                    <div className="cell-user">
                      <div className="avatar sm">{st.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <strong>{st.name}</strong>
                        <span className="muted small">{st.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>{st.course || '—'}<span className="muted small"> · {st.year_level || ''}</span></td>
                  <td><b>{st.applications_count}</b></td>
                  <td>
                    {st.latest_status ? <StatusBadge status={st.latest_status} /> : <span className="muted">Not applied</span>}
                  </td>
                  <td>
                    <Link className="link-btn" to={`/school/students/${st.id}`}>View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}