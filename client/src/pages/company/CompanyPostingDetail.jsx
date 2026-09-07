import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, StatusBadge, emptyState, CourseBadge } from '../../components/ui.jsx'
import MapView from '../../components/MapView.jsx'
import { toast } from '../../toast.jsx'

export default function CompanyPostingDetail() {
  const { id } = useParams()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [posting, setPosting] = useState(null)
  const [applicants, setApplicants] = useState(null)

  useEffect(() => {
    api(`/postings/${id}`, { token })
      .then(setPosting)
      .catch((e) => toast.error(e.message))
    api(`/applications/company?posting_id=${id}`, { token })
      .then(setApplicants)
      .catch((e) => toast.error(e.message))
  }, [id, token])

  if (!posting) return <Spinner />

  return (
    <div className="page">
      <Link className="back-link" to="/company">← Dashboard</Link>
      <header className="page-head">
        <div>
          <h1>{posting.title}</h1>
          <p className="muted">{posting.city}{posting.address ? ` · ${posting.address}` : ''}</p>
        </div>
        <div className="head-actions">
          <span className={'status-pill ' + (posting.status === 'open' ? 'open' : 'closed')}>
            {posting.status === 'open' ? '● Open' : '● Closed'}
          </span>
          <button className="btn btn-ghost" onClick={() => navigate(`/company/postings/${posting.id}/edit`)}>Edit</button>
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="card card-pad">
            <h3>Applicants ({applicants?.length || 0})</h3>
            {!applicants ? (
              <Spinner />
            ) : applicants.length === 0 ? (
              emptyState(
                'No applicants yet',
                'Your posting is live. Encourage applicants to apply, or broaden the courses selected.',
                <>
                  <button className="btn btn-ghost" onClick={() => navigate(`/company/postings/${id}/edit`)}>Edit courses</button>
                </>
              )
            ) : (
              <div className="app-list">
                {applicants.map((a) => (
                  <Link key={a.id} to={`/company/applications/${a.id}`} className="card app-row">
                    <div className="app-row-main">
                      <div className="job-logo">{a.applicant_name?.charAt(0).toUpperCase()}</div>
                      <div>
                        <h3>{a.applicant_name}</h3>
                        <span className="muted">{a.course}{a.school_name ? ` · ${a.school_name}` : ''}</span>
                      </div>
                    </div>
                    <div className="app-row-side">
                      <StatusBadge status={a.status} />
                      <span className="muted small">Applied {fmtDate(a.created_at)}</span>
                      <span className="arrow">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="detail-side">
          <div className="card card-pad">
            <h3>Role details</h3>
            <div className="job-tags">
              {posting.course_tags.map((t, i) => (
                <CourseBadge key={t} tag={t} index={i} />
              ))}
            </div>
            <p className="body-copy small">{posting.description}</p>
            {posting.requirements && (
              <>
                <h4 className="small-head">Requirements</h4>
                <p className="body-copy small">{posting.requirements}</p>
              </>
            )}
          </div>
          <div className="card card-pad">
            <h3>Location</h3>
            {posting.lat != null ? (
              <MapView markers={[{ ...posting, color: '#5B4BDB' }]} center={[posting.lat, posting.lng]} height="180px" />
            ) : (
              <p className="muted">{posting.city}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}