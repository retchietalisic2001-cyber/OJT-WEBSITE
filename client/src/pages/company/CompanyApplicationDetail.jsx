import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { useConfirm } from '../../confirm.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, StatusBadge, StatusStepper, Timeline, Modal } from '../../components/ui.jsx'
import ChatBox from '../../components/ChatBox.jsx'
import FileViewer from '../../components/FileViewer.jsx'
import { toast } from '../../toast.jsx'

const QUICK = [
  { status: 'under_review', label: 'Mark reviewing' },
  { status: 'interview', label: 'Invite to interview' },
  { status: 'accepted', label: 'Accept' },
  { status: 'rejected', label: 'Reject' }
]

const STATUS_CONFIRM = {
  under_review: { title: 'Mark as reviewing?', message: (n, t) => `${n}'s application for "${t}" will be marked "Under review".` },
  interview: { title: 'Invite to interview?', message: (n, t) => `${n} will be invited to an interview for "${t}".` },
  accepted: { title: 'Accept this applicant?', message: (n, t) => `${n} will be marked as ACCEPTED intern for "${t}".`, confirm: 'Accept' },
  rejected: { title: 'Decline this applicant?', message: () => '', confirm: 'Decline' }
}

export default function CompanyApplicationDetail() {
  const { id } = useParams()
  const { token } = useAuth()
  const confirm = useConfirm()
  const [app, setApp] = useState(null)
  const [busy, setBusy] = useState(false)
  const [viewingResume, setViewingResume] = useState(false)
  const [ivOpen, setIvOpen] = useState(false)
  const [ivDate, setIvDate] = useState('')
  const [ivTime, setIvTime] = useState('')
  const [ivNote, setIvNote] = useState('')
  const [ivLink, setIvLink] = useState('')

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  useEffect(() => {
    api(`/applications/${id}`, { token }).then(setApp).catch((e) => toast.error(e.message))
  }, [id, token])

  if (!app) return <Spinner />

  const STATUS_ORDER = { submitted: 0, under_review: 1, interview: 2, accepted: 3 }
  const curIdx = STATUS_ORDER[app.status]
  const locked = ['accepted', 'completed', 'rejected', 'withdrawn'].includes(app.status)
  const isStageDone = (status) => {
    if (locked) return true
    const t = STATUS_ORDER[status]
    return t !== undefined && curIdx !== undefined && t <= curIdx
  }

  const setStatus = async (status, customNote = '') => {
    let declineReason = ''
    if (status === 'rejected') {
      declineReason = window.prompt('Reason for declining this applicant (required):', '')
      if (declineReason == null) return
      declineReason = declineReason.trim()
      if (!declineReason) return toast.error('A reason is required — type why you are declining this application')
    }
    const cfg = STATUS_CONFIRM[status] || { title: `Change status to ${status}?`, message: () => 'The applicant will see this update.' }
    const ok = await confirm({
      title: cfg.title,
      message: status === 'rejected'
        ? `You will DECLINE ${app.applicant_name} for "${app.posting_title}" with the reason:\n"${declineReason}"`
        : cfg.message(app.applicant_name, app.posting_title),
      confirmLabel: cfg.confirm || 'Update status',
      danger: status === 'rejected'
    })
    if (!ok) return
    setBusy(true)
    try {
      const updated = await api(`/applications/${id}/status`, {
        method: 'PUT',
        token,
        body: { status, note: declineReason || customNote }
      })
      setApp(updated)
      toast.success('Status updated — applicant will see it immediately')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const submitInterview = async () => {
    if (!ivDate || !ivTime) return toast.error('Pick a date and time for the interview')
    setBusy(true)
    try {
      const updated = await api(`/applications/${id}/status`, {
        method: 'PUT',
        token,
        body: { status: 'interview', note: ivNote, interview_date: ivDate, interview_time: ivTime, interview_link: ivLink }
      })
      setApp(updated)
      setIvOpen(false)
      setIvDate('')
      setIvTime('')
      setIvNote('')
      setIvLink('')
      toast.success('Interview invitation sent — the applicant will see the schedule in their progress')
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
            <p className="muted small">Each update adds a step to the applicant's timeline. Statuses move forward only — once a stage is reached it can't be undone.</p>
            <div className="quick-status">
              {QUICK.map((q) => (
                <button
                  key={q.status}
                  className="btn btn-ghost btn-sm"
                  disabled={busy || isStageDone(q.status)}
                  title={isStageDone(q.status) ? 'This stage is already past — statuses move forward only' : q.label}
                  onClick={() => (q.status === 'interview' ? setIvOpen(true) : setStatus(q.status))}
                >
                  {q.label}
                </button>
              ))}
            </div>
            {locked && <p className="muted small mt">This application is finalized — no further status changes.</p>}
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
            <div className="section-head">
              <h3>📄 Resume</h3>
            </div>
            {app.resume_path ? (
              <>
                <p className="muted small">{app.resume_name || 'Resume'} — attached with the application.</p>
                <button className="btn btn-primary btn-block" onClick={() => setViewingResume(true)}>View resume</button>
              </>
            ) : (
              <p className="muted small">The applicant hasn't attached a resume yet. You can ask for one in the chat below.</p>
            )}
          </div>
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

      {viewingResume && app.resume_path && (
        <FileViewer
          files={[{ file_path: app.resume_path, file_name: app.resume_name || 'Resume', file_size: app.resume_size }]}
          onClose={() => setViewingResume(false)}
        />
      )}

      <Modal open={ivOpen} onClose={() => setIvOpen(false)} title={`Interview invitation — ${app.applicant_name.split(' ')[0]}`} width="440px">
        <p className="muted small">Pick the date and time, and the applicant will see it in their progress timeline.</p>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Interview date</span>
            <input type="date" className="input" min={todayStr} value={ivDate} onChange={(e) => setIvDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Interview time</span>
            <input type="time" className="input" value={ivTime} onChange={(e) => setIvTime(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Note for the applicant (optional)</span>
          <textarea
            className="input textarea"
            rows={3}
            value={ivNote}
            onChange={(e) => setIvNote(e.target.value)}
            placeholder="e.g. Please prepare for a 30-minute video call. Bring any documents you may need…"
          />
        </label>
        <label className="field">
          <span className="field-label">Meeting link or location (optional)</span>
          <input className="input" value={ivLink} onChange={(e) => setIvLink(e.target.value)} placeholder="https://meet.google.com/… or office address" />
        </label>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={() => setIvOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={submitInterview}>
            {busy ? 'Sending…' : 'Send interview invitation'}
          </button>
        </div>
      </Modal>
    </div>
  )
}