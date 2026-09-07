import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, StatusBadge, StatusStepper, Timeline } from '../../components/ui.jsx'
import ChatBox from '../../components/ChatBox.jsx'
import { toast } from '../../toast.jsx'

const QUICK = [
  { status: 'under_review', label: 'Mark reviewing' },
  { status: 'interview', label: 'Invite to interview' },
  { status: 'accepted', label: 'Accept' },
  { status: 'rejected', label: 'Reject' }
]

export default function CompanyApplicationDetail() {
  const { id } = useParams()
  const { token } = useAuth()
  const [app, setApp] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api(`/applications/${id}`, { token }).then(setApp).catch((e) => toast.error(e.message))
  }, [id, token])

  if (!app) return <Spinner />

  const setStatus = async (status, customNote = '') => {
    setBusy(true)
    try {
      const updated = await api(`/applications/${id}/status`, {
        method: 'PUT',
        token,
        body: { status, note: customNote || note }
      })
      setApp(updated)
      setNote('')
      toast.success('Status updated — applicant will see it immediately')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Link className="back-link" to={`/company/postings/${app.posting_id}`}>← {app.posting_title} applicants</Link>

      <header className="page-head">
        <div>
          <h1>{app.applicant_name}</h1>
          <p className="muted">
            {app.course}{app.year_level ? ` · ${app.year_level}` : ''}
            {app.school_name ? ` · ${app.school_name}` : ''}
          </p>
        </div>
        <StatusBadge status={app.status} />
      </header>

      <div className="detail-grid app-detail">
        <div className="detail-main">
          <div className="card card-pad">
            <h3>Update status</h3>
            <p className="muted small">Each update adds a step to the applicant's timeline.</p>
            <div className="quick-status">
              {QUICK.map((q) => (
                <button key={q.status} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus(q.status)}>
                  {q.label}
                </button>
              ))}
            </div>
            <label className="field mt">
              <span className="field-label">Note for the applicant (optional)</span>
              <textarea className="input textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please prepare for a virtual interview on Thursday…" />
            </label>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={busy} onClick={() => setStatus('under_review', '')}>Save note</button>
            </div>
          </div>

          <div className="card card-pad">
            <h3>Progress</h3>
            <StatusStepper history={app.status_history} />
            <Timeline history={app.status_history} />
          </div>

          <div className="card card-pad">
            <div className="section-head">
              <h3>Chat with {app.applicant_name.split(' ')[0]}</h3>
            </div>
            <p className="muted small">Ask for requirements, request documents, or confirm interview schedules — everything stays in one thread.</p>
            <ChatBox applicationId={app.id} />
          </div>
        </div>

        <div className="detail-side">
          <div className="card card-pad">
            <h3>Applicant details</h3>
            <table className="mini-table">
              <tbody>
                <tr><td>Email</td><td>{app.applicant_email}</td></tr>
                {app.phone && <tr><td>Phone</td><td>{app.phone}</td></tr>}
                <tr><td>Course</td><td>{app.course || '—'}</td></tr>
                <tr><td>School</td><td>{app.school_name || '—'}</td></tr>
                <tr><td>Applied</td><td>{fmtDate(app.created_at)}</td></tr>
              </tbody>
            </table>
          </div>
          {app.cover_message && (
            <div className="card card-pad">
              <h3>Cover message</h3>
              <p className="body-copy small quote">“{app.cover_message}”</p>
            </div>
          )}
          <div className="card card-pad">
            <h3>The role</h3>
            <p className="body-copy small"><b>{app.posting_title}</b></p>
            <p className="body-copy small">{app.posting_requirements || app.posting_description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}