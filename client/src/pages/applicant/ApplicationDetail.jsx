import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { useConfirm } from '../../confirm.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, StatusBadge, StatusStepper, Timeline, Modal } from '../../components/ui.jsx'
import ChatBox from '../../components/ChatBox.jsx'
import { toast } from '../../toast.jsx'

export default function ApplicationDetail() {
  const { id } = useParams()
  const { token } = useAuth()
  const confirm = useConfirm()
  const [app, setApp] = useState(null)
  const [attaching, setAttaching] = useState(false)
  const [abandonOpen, setAbandonOpen] = useState(false)
  const [abandonReason, setAbandonReason] = useState('')
  const [abandonBusy, setAbandonBusy] = useState(false)

  useEffect(() => {
    api(`/applications/${id}`, { token }).then(setApp).catch((e) => toast.error(e.message))
  }, [id, token])

  const withdraw = async () => {
    const ok = await confirm({
      title: 'Withdraw application?',
      message: `This will withdraw your application for "${app?.posting_title || 'this role'}". The company will no longer see it in their list.`,
      confirmLabel: 'Withdraw'
    })
    if (!ok) return
    try {
      const updated = await api(`/applications/${id}/withdraw`, { method: 'POST', token })
      setApp(updated)
      toast.success('Application withdrawn')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const attachResume = async () => {
    const ok = await confirm({
      title: 'Attach resume?',
      message: 'Your resume will be sent to the company in this conversation.',
      confirmLabel: 'Attach resume',
      danger: false
    })
    if (!ok) return
    setAttaching(true)
    try {
      await api(`/resume/applications/${id}/attach-resume`, { method: 'POST', token })
      toast.success('Resume sent to the conversation')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setAttaching(false)
    }
  }

  const abandon = async () => {
    const reason = abandonReason.trim()
    if (!reason) return toast.error('Please tell us why you are abandoning this offer')
    const ok = await confirm({
      title: 'Abandon this offer?',
      message: `You will give up the accepted offer for "${app.posting_title}" at ${app.company_name}.\n\nReason: "${reason}"`,
      confirmLabel: 'Abandon offer',
      danger: true
    })
    if (!ok) return
    setAbandonBusy(true)
    try {
      const updated = await api(`/applications/${id}/abandon`, { method: 'POST', token, body: { reason } })
      setApp(updated)
      setAbandonOpen(false)
      setAbandonReason('')
      toast.success('Offer abandoned — the company has been notified')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setAbandonBusy(false)
    }
  }

  if (!app) return <Spinner />

  return (
    <div className="page">
      <Link className="back-link" to="/app/applications">← My applications</Link>

      <header className="page-head">
        <div className="app-head-info">
          <div className="job-logo" style={{ width: 44, height: 44 }}>
            {app.company_logo ? <img src={app.company_logo} alt={app.company_name} /> : app.company_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1>{app.posting_title}</h1>
            <p className="muted">{app.company_name} · {app.city}{app.address ? ` · ${app.address}` : ''}</p>
          </div>
        </div>
        <div className="head-actions">
          <StatusBadge status={app.status} />
          {!['accepted', 'completed', 'rejected', 'withdrawn'].includes(app.status) && (
            <button className="btn btn-ghost btn-sm danger" onClick={withdraw}>Withdraw</button>
          )}
          {app.status === 'accepted' && (
            <button className="btn btn-ghost btn-sm danger" onClick={() => setAbandonOpen(true)}>Abandon offer</button>
          )}
        </div>
      </header>

      <div className="detail-grid app-detail">
        <div className="detail-main">
          <div className="card card-pad">
            <h3>Application progress</h3>
            <StatusStepper history={app.status_history} />
            <Timeline history={app.status_history} />
          </div>

          <div className="card card-pad">
            <div className="section-head">
              <h3>Chat with {app.company_name}</h3>
              <div className="head-actions">
                <Link className="btn btn-ghost btn-sm" to="/app/resume">Edit resume</Link>
                <button className="btn btn-primary btn-sm" onClick={attachResume} disabled={attaching}>
                  {attaching ? 'Sending…' : '📎 Attach resume'}
                </button>
              </div>
            </div>
            <p className="muted small">Send requirements, documents, or photos here — no need to visit the office.</p>
            <ChatBox applicationId={app.id} />
          </div>
        </div>

        <div className="detail-side">
          <div className="card card-pad">
            <h3>Your application</h3>
            <p className="body-copy small">Submitted {fmtDate(app.created_at)}</p>
            {app.cover_message && <p className="body-copy small quote">“{app.cover_message}”</p>}
            <p className="muted small">Latest update: {fmtDate(app.updated_at)}</p>
          </div>
          <div className="card card-pad">
            <h3>The role</h3>
            <p className="body-copy small">{app.posting_description || 'No description.'}</p>
          </div>
        </div>
      </div>

      <Modal open={abandonOpen} onClose={() => setAbandonOpen(false)} title="Abandon the accepted offer" width="460px">
        <p className="muted small">
          You are about to give up the accepted offer for <b>“{app.posting_title}”</b> at <b>{app.company_name}</b>. This cannot be undone,
          and the company will be notified. Please tell them why.
        </p>
        <label className="field">
          <span className="field-label">Reason for abandoning (required)</span>
          <textarea
            className="input textarea"
            rows={3}
            value={abandonReason}
            onChange={(e) => setAbandonReason(e.target.value)}
            placeholder="e.g. I already accepted another OJT offer…"
          />
        </label>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={() => setAbandonOpen(false)}>Cancel</button>
          <button className="btn btn-danger" disabled={abandonBusy} onClick={abandon}>
            {abandonBusy ? 'Abandoning…' : 'Abandon offer'}
          </button>
        </div>
      </Modal>
    </div>
  )
}