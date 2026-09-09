import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { useConfirm } from '../../confirm.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, CourseBadge, StatusBadge, Modal, emptyState } from '../../components/ui.jsx'
import MapView from '../../components/MapView.jsx'
import { toast } from '../../toast.jsx'

export default function PostingDetail() {
  const { id } = useParams()
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [posting, setPosting] = useState(null)
  const [cover, setCover] = useState('')
  const [modal, setModal] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    api(`/postings/${id}`, { token })
      .then(setPosting)
      .catch((e) => toast.error(e.message))
  }, [id, token])

  if (!posting) return <Spinner />

  const alreadyApplied = !!posting.applied_status

  const apply = async () => {
    const ok = await confirm({
      title: 'Submit application?',
      message: `You're applying for "${posting.title}" at ${posting.company_name}. You can withdraw your application later from My Applications.`,
      confirmLabel: 'Submit application',
      danger: false
    })
    if (!ok) return
    setApplying(true)
    try {
      const created = await api('/applications', { method: 'POST', token, body: { posting_id: posting.id, cover_message: cover } })
      if (created.resume_missing) {
        toast.success('Application submitted! Tip: build your resume in the Resume Builder so it is attached to your applications.')
      } else if (created.resume_attached) {
        toast.success('Application submitted! Your resume was attached automatically for the company to review.')
      } else {
        toast.success('Application submitted! Track it under My Applications.')
      }
      setModal(false)
      setPosting({ ...posting, applied_status: 'submitted' })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="page">
      <Link className="back-link" to="/app/browse">← Back to browse</Link>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="card job-hero">
            <div className="job-card-top">
              <div className="job-logo lg">{posting.company_name?.charAt(0).toUpperCase()}</div>
              <div className="job-title-wrap">
                <h1>{posting.title}</h1>
                <span className="muted">
                  {posting.company_name} · {posting.industry}
                  {posting.is_verified && <span className="verified-chip" title="Verified company">✓ Verified</span>}
                </span>
                <span className="muted">📍 {posting.address}</span>
              </div>
            </div>
            <div className="job-tags">
              {posting.course_tags.map((t, i) => (
                <CourseBadge key={t} tag={t} index={i} />
              ))}
            </div>
            <div className="job-meta-row">
              <div className="meta-pill"><b>{posting.slots}</b> slot{posting.slots > 1 ? 's' : ''}</div>
              <div className="meta-pill">Posted {fmtDate(posting.created_at)}</div>
              {posting.distance_km != null && <div className="meta-pill">📍 {posting.distance_km.toFixed(1)} km away</div>}
            </div>
            {alreadyApplied ? (
              <div className="applied-banner">
                <StatusBadge status={posting.applied_status} />
                <span>You already applied to this role.</span>
                <Link className="btn btn-ghost btn-sm" to={`/app/applications/${posting.application_id}`}>Open my application →</Link>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={() => setModal(true)}>Apply now</button>
            )}
          </div>

          <div className="card card-pad">
            <h2>About the role</h2>
            <p className="body-copy">{posting.description || 'No description provided.'}</p>
          </div>

          <div className="card card-pad">
            <h2>Requirements</h2>
            <p className="body-copy">{posting.requirements || 'No stated requirements yet — ask in chat after applying.'}</p>
          </div>
        </div>

        <div className="detail-side">
          <div className="card card-pad">
            <h3>Office location</h3>
            {posting.lat != null ? (
              <MapView
                markers={[{ ...posting, color: '#5B4BDB' }]}
                center={[posting.lat, posting.lng]}
                height="200px"
              />
            ) : (
              <p className="muted">{posting.city || 'No map location set'}</p>
            )}
            <p className="muted small">{posting.address}</p>
          </div>
          <div className="card card-pad company-card">
            <h3>About {posting.company_name}</h3>
            <p className="body-copy small">{posting.company_description || 'No company description yet.'}</p>
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Apply for this role">
        <p className="muted">Applying for <b>{posting.title}</b> at <b>{posting.company_name}</b>.</p>
        <label className="field">
          <span className="field-label">Message to the company (optional)</span>
          <textarea
            className="input textarea"
            rows={5}
            placeholder="Introduce yourself and why you want this OJT…"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
          />
        </label>
        <p className="muted small">Your saved resume (from the Resume Builder) is attached automatically with your application. You can send more documents through the chat after applying.</p>
        <button className="btn btn-primary btn-block" onClick={apply} disabled={applying}>
          {applying ? 'Submitting…' : 'Submit application'}
        </button>
      </Modal>
    </div>
  )
}