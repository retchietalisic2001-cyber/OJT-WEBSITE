import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../store.jsx'
import { useConfirm } from '../confirm.jsx'
import { toast } from '../toast.jsx'
import { Spinner } from './ui.jsx'
import FileViewer from './FileViewer.jsx'

const DOC_OPTIONS = {
  valid_id: '🪪 Valid ID (authorized representative)',
  registration: '📜 Registration certificate (SEC · DTI · CHED)',
  permit: '🏛️ Business / operating permit',
  credentials: '🗂️ Other credentials or papers'
}

const STATUS = {
  pending: { label: 'Pending review', cls: 'pending' },
  approved: { label: 'Approved', cls: 'approved' },
  rejected: { label: 'Rejected', cls: 'rejected' }
}

function fmtDay(ts) {
  if (!ts) return '—'
  return String(ts).slice(0, 10)
}

export default function VerificationPanel({ role }) {
  const { token } = useAuth()
  const confirm = useConfirm()
  const [docs, setDocs] = useState(null)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [documentType, setDocumentType] = useState('valid_id')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState(null)
  const [view, setView] = useState(null)

  const load = async () => {
    try {
      const [m, all] = await Promise.all([api('/verify/mine', { token }), api('/verify/status', { token })])
      setDocs(m || [])
      setStatus(all)
    } catch {
      setDocs([])
      setStatus({ verified: false, pendingCount: 0 })
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (!docs || !status) return <Spinner />

  const submit = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Choose a file to upload')
    const ok = await confirm({
      title: 'Submit document for review?',
      message: `"${file.name}" will be sent to the admin for verification. Pending documents cannot be edited until the admin reviews them.`,
      confirmLabel: 'Submit for review',
      danger: false
    })
    if (!ok) return
    setBusy(true)
    const fd = new FormData()
    fd.append('document_type', documentType)
    fd.append('label', label)
    fd.append('file', file)
    try {
      await api('/verify', { method: 'POST', token, form: fd })
      toast.success('Document submitted for review')
      setLabel('')
      setFile(null)
      e.target.reset()
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    const ok = await confirm({
      title: 'Remove this document?',
      message: 'This document will be removed from verification. You can upload a new one anytime.',
      confirmLabel: 'Remove'
    })
    if (!ok) return
    try {
      await api(`/verify/${id}`, { method: 'DELETE', token })
      toast.success('Removed')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="card card-pad mt">
      <h3>Verification documents</h3>
      <p className="muted small">
        Upload a valid ID of the account holder plus official credentials/papers to prove this{' '}
        {role === 'company' ? 'company' : 'school'} is legitimate. Applicants can see a Verified badge on your{' '}
        {role === 'company' ? 'postings' : 'profile'}.
      </p>

      {status.verified ? (
        <div className="verify-banner verified">✓ Verified — your documents have been approved.</div>
      ) : status.pendingCount > 0 ? (
        <div className="verify-banner pending">⏳ {status.pendingCount} document{status.pendingCount > 1 ? 's' : ''} waiting for admin review.</div>
      ) : (
        <div className="verify-banner unverified">⚠️ Not verified yet — submit your documents below.</div>
      )}

      {docs.length > 0 && (
        <div className="verify-docs">
          {docs.map((d) => {
            const st = STATUS[d.status] || STATUS.pending
            return (
              <div key={d.id} className="admin-row">
                <div className="admin-row-main">
                  <strong>{DOC_OPTIONS[d.document_type] || 'Document'}{d.label ? ` — ${d.label}` : ''}</strong>
                  <span className="muted small">
                    {d.file_name} · {Math.round(d.file_size / 1024)} KB · submitted {fmtDay(d.created_at)}
                  </span>
                  {d.status === 'rejected' && d.note && <span className="muted small">Admin note: {d.note}</span>}
                </div>
                <div className="admin-row-meta">
                  <span className={'req-badge ' + st.cls}>{st.label}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setView(d)}>View 🔍</button>
                  {d.status !== 'approved' && (
                    <button className="btn btn-sm btn-danger" onClick={() => remove(d.id)}>Remove</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <form onSubmit={submit} className="form-grid mt">
        <label className="field">Document type
          <select className="input" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            {Object.entries(DOC_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field">Label (optional)
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. SEC Certificate of Registration" />
        </label>
        <label className="field full">File (JPG, PNG, PDF, Word up to 10 MB)
          <input className="input" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
        </label>
        <div className="full">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload for review'}</button>
        </div>
      </form>
      {view && <FileViewer files={[view]} onClose={() => setView(null)} />}
    </div>
  )
}