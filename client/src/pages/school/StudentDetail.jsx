import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, StatusBadge, Timeline, emptyState } from '../../components/ui.jsx'

export default function StudentDetail() {
  const { id } = useParams()
  const { token } = useAuth()
  const [stu, setStu] = useState(null)

  useEffect(() => {
    api(`/schools/students/${id}`, { token }).then(setStu).catch(() => setStu({ error: true }))
  }, [id, token])

  if (!stu) return <Spinner />
  if (stu.error) return <div className="card card-pad">{emptyState('Student not found')}</div>

  return (
    <div className="page">
      <Link className="back-link" to="/school">← All students</Link>

      <header className="page-head">
        <div>
          <h1>{stu.name}</h1>
          <p className="muted">{stu.course}{stu.year_level ? ` · ${stu.year_level}` : ''}{stu.search_city ? ` · area: ${stu.search_city}` : ''}</p>
        </div>
        <div className="head-actions">
          {stu.applications?.length > 0 ? (
            <StatusBadge status={stu.applications[0]?.status} />
          ) : (
            <span className="badge" style={{ color: '#D97706', background: '#FDF3E3' }}>Not applied yet</span>
          )}
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="card card-pad">
            <h3>Applications ({stu.applications?.length || 0})</h3>
            {stu.applications?.length ? (
              <div className="app-list">
                {stu.applications.map((a) => (
                  <div key={a.id} className="card app-row static">
                    <div className="app-row-main">
                      <div className="job-logo">{a.company_name?.charAt(0).toUpperCase()}</div>
                      <div>
                        <h3>{a.posting_title}</h3>
                        <span className="muted">{a.company_name} · {a.city}</span>
                      </div>
                    </div>
                    <div className="app-row-side">
                      <StatusBadge status={a.status} />
                      <span className="muted small">Applied {fmtDate(a.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              emptyState('No applications yet', 'This student has not applied to any company yet.')
            )}
          </div>
        </div>

        <div className="detail-side">
          {stu.applications?.map((a) =>
            a.status_history?.length ? (
              <div key={a.id} className="card card-pad">
                <h3>{a.company_name}</h3>
                <Timeline history={a.status_history} />
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}