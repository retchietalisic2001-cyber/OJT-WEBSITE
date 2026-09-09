import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { toast } from '../../toast.jsx'
import { Spinner, Modal } from '../../components/ui.jsx'
import { useAuth } from '../../store.jsx'
import { useConfirm } from '../../confirm.jsx'

const DOC_NAMES = {
  valid_id: '🪪 Valid ID',
  registration: '📜 Registration certificate',
  permit: '🏛️ Operating permit',
  credentials: '🗂️ Other credentials'
}

const VERIFY_STATUS = {
  pending: { label: 'Pending', cls: 'pending' },
  approved: { label: 'Approved', cls: 'approved' },
  rejected: { label: 'Rejected', cls: 'rejected' }
}

function verifyFmtSize(bytes) {
  const kb = Math.round(bytes / 1024)
  return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB'
}

function VerifyRow({ v, onReview, onDelete }) {
  const st = VERIFY_STATUS[v.status] || VERIFY_STATUS.pending
  const org = v.org_name || v.email
  return (
    <div className="admin-row">
      <div className="admin-row-main">
        <strong>{DOC_NAMES[v.document_type] || v.document_type}{v.label ? ` — ${v.label}` : ''}</strong>
        <span className="muted small">{{ company: '🏢', school: '🏫' }[v.kind] || ''} {org} · {v.file_name} · {verifyFmtSize(v.file_size)} · submitted {fmtDay(v.created_at)}</span>
        {v.note && <span className="muted small">Note: {v.note}</span>}
      </div>
      <div className="admin-row-meta">
        <span className={'req-badge ' + st.cls}>{st.label}</span>
        <a className="btn btn-sm btn-ghost" href={v.file_path} target="_blank" rel="noreferrer">View</a>
        {v.status === 'pending' && (
          <>
            <button className="btn btn-sm btn-primary" onClick={() => onReview(v, 'approved')}>Approve</button>
            <button className="btn btn-sm btn-danger" onClick={() => onReview(v, 'rejected')}>Reject</button>
          </>
        )}
        <button className="btn btn-sm btn-danger" onClick={() => onDelete(v.id)}>Delete</button>
      </div>
    </div>
  )
}

const EMPTY = { name: '', email: '', username: '', password: '', phone: '' }

function CompanyForm({ onDone, initial }) {
  const { token } = useAuth()
  const confirm = useConfirm()
  const [f, setF] = useState({ ...EMPTY, ...initial, username: '', password: '', companyName: initial?.companyName || '', industry: initial?.industry || '', description: initial?.description || '', address: initial?.address || '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    const ok = await confirm({
      title: 'Create company account?',
      message: `A company account for "${f.companyName || f.name}" will be created${f.email ? ` with email ${f.email}` : ''}. This action creates a new user.`,
      confirmLabel: 'Create account',
      danger: false
    })
    if (!ok) return
    setBusy(true)
    try {
      await api('/admin/users/company', { method: 'POST', token, body: f })
      toast.success('Company account created')
      onDone()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="form-grid">
      {initial && (
        <p className="muted small full">Creating this account from a request — set a temporary password to share with them.</p>
      )}
      <label className="field">Company name
        <input className="input" value={f.companyName} onChange={(e) => set('companyName', e.target.value)} required placeholder="e.g. TechNova Solutions" />
      </label>
      <label className="field">Industry
        <input className="input" value={f.industry} onChange={(e) => set('industry', e.target.value)} placeholder="e.g. IT Services" />
      </label>
      <label className="field">Contact person name
        <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. Ana Reyes" />
      </label>
      <label className="field">Email
        <input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required placeholder="company@example.com" />
      </label>
      <label className="field">Username
        <input className="input" value={f.username} onChange={(e) => set('username', e.target.value)} placeholder="optional username" />
      </label>
      <label className="field">Temporary password
        <input className="input" type="text" value={f.password} onChange={(e) => set('password', e.target.value)} required minLength={6} placeholder="min 6 characters" />
      </label>
      <label className="field">Contact number
        <input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="09xx xxx xxxx" />
      </label>
      <label className="field">Head office address
        <input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Street, City" />
      </label>
      <label className="field full">Company description
        <textarea className="input textarea" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What does this company do?" />
      </label>
      <div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create company account'}</button>
      </div>
    </form>
  )
}

function SchoolForm({ onDone, initial }) {
  const { token } = useAuth()
  const confirm = useConfirm()
  const [f, setF] = useState({ ...EMPTY, ...initial, username: '', password: '', schoolName: initial?.schoolName || '', position: initial?.position || 'OJT Coordinator' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    const ok = await confirm({
      title: 'Create school account?',
      message: `A school account for "${f.schoolName || f.name}" will be created${f.email ? ` with email ${f.email}` : ''}. This action creates a new user.`,
      confirmLabel: 'Create account',
      danger: false
    })
    if (!ok) return
    setBusy(true)
    try {
      await api('/admin/users/school', { method: 'POST', token, body: f })
      toast.success('School account created')
      onDone()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="form-grid">
      {initial && (
        <p className="muted small full">Creating this account from a request — set a temporary password to share with them.</p>
      )}
      <label className="field">School name
        <input className="input" value={f.schoolName} onChange={(e) => set('schoolName', e.target.value)} required placeholder="e.g. University of the East" />
      </label>
      <label className="field">Coordinator position
        <input className="input" value={f.position} onChange={(e) => set('position', e.target.value)} required />
      </label>
      <label className="field">Coordinator name
        <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. Ms. Angela Reyes" />
      </label>
      <label className="field">Email
        <input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required placeholder="coordinator@school.edu.ph" />
      </label>
      <label className="field">Username
        <input className="input" value={f.username} onChange={(e) => set('username', e.target.value)} placeholder="optional username" />
      </label>
      <label className="field">Temporary password
        <input className="input" type="text" value={f.password} onChange={(e) => set('password', e.target.value)} required minLength={6} placeholder="min 6 characters" />
      </label>
      <label className="field">Contact number
        <input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="09xx xxx xxxx" />
      </label>
      <div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create school account'}</button>
      </div>
    </form>
  )
}

function UserRow({ u, label, onDelete }) {
  const confirm = useConfirm()
  return (
    <div className="admin-row">
      <div className="admin-row-main">
        <strong>{u.company_name || u.school_name || u.name}</strong>
        <span className="muted small">
          {label} — {u.name} · {u.email}
          {u.username ? ` · @${u.username}` : ''}
        </span>
      </div>
      <div className="admin-row-meta">
        <span className="muted small">Since {fmtDay(u.created_at)}</span>
        <button
          className="btn btn-sm btn-danger"
          onClick={async () => {
            const ok = await confirm({
              title: `Delete ${label.toLowerCase()} account?`,
              message: `This will permanently delete "${u.company_name || u.school_name}" and all of its postings and data. This cannot be undone.`,
              confirmLabel: 'Delete'
            })
            if (ok) onDelete(u.id)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

const ROLE_META = {
  applicant: { label: 'Applicant', icon: '🧑‍🎓' },
  company: { label: 'Company', icon: '🏢' },
  school: { label: 'School', icon: '🏫' },
  admin: { label: 'Admin', icon: '🛡️' }
}

function UserList({ users, onDelete }) {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const needle = q.trim().toLowerCase()
  const filtered = users.filter(
    (u) =>
      (role === 'all' || u.role === role) &&
      (!needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
  )

  return (
    <div className="card table-card">
      <div className="admin-filters">
        <input className="input" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          {['all', 'applicant', 'company', 'school', 'admin'].map((r) => (
            <button key={r} className={role === r ? 'active' : ''} onClick={() => setRole(r)}>
              {r === 'all' ? 'All' : ROLE_META[r].label}
            </button>
          ))}
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Verification</th>
            <th>Member since</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan="5" className="muted">No users match.</td></tr>
          ) : (
            filtered.map((u) => {
              const rm = ROLE_META[u.role] || { label: u.role, icon: '' }
              return (
                <tr key={u.id}>
                  <td>
                    <div className="cell-user">
                      <div className="avatar sm">{u.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <strong>{u.name}</strong>
                        <span className="muted small">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="muted small">{rm.icon} {rm.label}</span>
                    {u.company_name || u.school_name ? <strong className="muted small"> · {u.company_name || u.school_name}</strong> : null}
                    {u.role === 'company' && u.postings_count > 0 ? <span className="muted small"> · {u.postings_count} posting{u.postings_count > 1 ? 's' : ''}</span> : null}
                  </td>
                  <td>
                    {u.role === 'applicant' || u.role === 'admin' ? (
                      <span className="muted small">—</span>
                    ) : u.is_verified || u.approved_docs > 0 ? (
                      <span className="req-badge approved">Verified</span>
                    ) : u.pending_docs > 0 ? (
                      <span className="req-badge pending">Pending ({u.pending_docs})</span>
                    ) : (
                      <span className="req-badge rejected">Not verified</span>
                    )}
                  </td>
                  <td className="muted small">{fmtDay(u.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {u.role !== 'admin' && (
                      <button className="btn btn-sm btn-danger" onClick={() => onDelete(u)}>Delete</button>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function fmtDay(ts) {
  if (!ts) return '—'
  return String(ts).slice(0, 10)
}

const REQ_META = {
  pending: { label: 'Pending', cls: 'pending' },
  contacted: { label: 'Contacted', cls: 'contacted' },
  completed: { label: 'Completed', cls: 'completed' },
  approved: { label: 'Approved', cls: 'approved' },
  rejected: { label: 'Rejected', cls: 'rejected' }
}

const REQ_FIELDS = {
  company: [
    ['company', 'Company name'],
    ['industry', 'Industry'],
    ['contact', 'Contact person'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['address', 'Address']
  ],
  school: [
    ['school', 'School / university'],
    ['coordinator', 'Coordinator'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['position', 'Position']
  ]
}

function RequestCard({ r, onStatus, onApprove, onDecline, onDelete }) {
  const confirm = useConfirm()
  const meta = REQ_META[r.status] || REQ_META.pending
  const fields = REQ_FIELDS[r.kind] || []
  const d = r.details || {}
  return (
    <div className="admin-row req-row">
      <div className="admin-row-main">
        <div className="req-top">
          <strong>{r.kind === 'company' ? '🏢 Company request' : '🏫 School request'}</strong>
          <span className={'req-badge ' + meta.cls}>{meta.label}</span>
        </div>
        <span className="muted small">{fmtDay(r.created_at)}</span>
        <div className="req-fields">
          {fields.map(([key, label]) => (
            d[key] ? <div key={key} className="req-field"><span>{label}:</span> <strong>{d[key]}</strong></div> : null
          ))}
          {r.file_path && (
            <div className="req-field">
              <span>Documents ({r.file2_path ? 2 : 1}):</span>
              <a className="link-btn" href={r.file_path} target="_blank" rel="noreferrer">{r.file_name} · {verifyFmtSize(r.file_size)}</a>
              {r.file2_path && (
                <>
                  <span className="muted small"> · </span>
                  <a className="link-btn" href={r.file2_path} target="_blank" rel="noreferrer">{r.file2_name} · {verifyFmtSize(r.file2_size)}</a>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="admin-row-meta req-actions">
        {['pending', 'contacted'].includes(r.status) && (
          <>
            <button className="btn btn-sm btn-primary" onClick={() => onApprove(r)}>✓ Approve</button>
            <button className="btn btn-sm btn-danger" onClick={() => onDecline(r)}>✕ Decline</button>
          </>
        )}
        {r.status === 'pending' && (
          <button className="btn btn-sm btn-ghost" onClick={async () => {
            const ok = await confirm({
              title: 'Mark as contacted?',
              message: 'This request will be marked "Contacted" — indicating you have reached out to the requester.',
              confirmLabel: 'Mark contacted',
              danger: false
            })
            if (ok) onStatus(r.id, 'contacted')
          }}>Mark contacted</button>
        )}
        {r.status === 'contacted' && (
          <button className="btn btn-sm btn-ghost" onClick={async () => {
            const ok = await confirm({
              title: 'Mark as done?',
              message: 'This request will be marked "Completed" when the requester has been fully assisted.',
              confirmLabel: 'Mark done',
              danger: false
            })
            if (ok) onStatus(r.id, 'completed')
          }}>Mark done</button>
        )}
        <button className="btn btn-sm btn-danger" onClick={async () => {
          const ok = await confirm({
            title: 'Delete this request?',
            message: 'This request and its documents will be permanently deleted.',
            confirmLabel: 'Delete'
          })
          if (ok) onDelete(r.id)
        }}>Delete</button>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { token } = useAuth()
  const confirm = useConfirm()
  const [tab, setTab] = useState('companies')
  const [data, setData] = useState({ companies: [], schools: [] })
  const [requests, setRequests] = useState([])
  const [verifications, setVerifications] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [approveTarget, setApproveTarget] = useState(null)

  const load = async () => {
    try {
      const [d, r, v, u] = await Promise.all([
        api('/admin/users', { method: 'GET', token }),
        api('/support/requests', { method: 'GET', token }),
        api('/verify/all', { method: 'GET', token }),
        api('/admin/users/all', { method: 'GET', token })
      ])
      setData(d)
      setRequests(r || [])
      setVerifications(v || [])
      setUsers(u || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (id) => {
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE', token })
      toast.success('Account deleted')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const setRequestStatus = async (id, status) => {
    try {
      await api(`/support/requests/${id}`, { method: 'PATCH', token, body: { status } })
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const deleteRequest = async (id) => {
    try {
      await api(`/support/requests/${id}`, { method: 'DELETE', token })
      toast.success('Request deleted')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const approveRequest = async (r) => {
    const ok = await confirm({
      title: 'Approve request — create account?',
      message: `The ${r.kind} account for "${(r.details || {}).company || (r.details || {}).school || 'this requester'}" will be created, and the request marked as approved. A confirmation email will be sent to ${(r.details || {}).email || 'the requester'}.`,
      confirmLabel: 'Approve & create account',
      danger: false
    })
    if (!ok) return
    try {
      await api(`/support/requests/${r.id}`, { method: 'PATCH', token, body: { status: 'approved' } })
      toast.success('Request approved — account created')
      setApproveTarget(null)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const declineRequest = async (r) => {
    const ok = await confirm({
      title: 'Decline this request?',
      message: `The ${r.kind} account request from "${(r.details || {}).company || (r.details || {}).school || 'this requester'}" will be declined. They will receive a notification email and will not get an account.`,
      confirmLabel: 'Decline'
    })
    if (!ok) return
    try {
      await api(`/support/requests/${r.id}`, { method: 'PATCH', token, body: { status: 'rejected' } })
      toast.success('Request declined')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const deleteUser = async (u) => {
    const name = u.company_name || u.school_name || u.name
    const ok = await confirm({
      title: `Delete ${u.role} account?`,
      message: `This will permanently delete "${name}"'s account and ALL of their data. This cannot be undone.`,
      confirmLabel: 'Delete'
    })
    if (!ok) return
    try {
      await api(`/admin/users/${u.id}`, { method: 'DELETE', token })
      toast.success('User deleted')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const reviewVerification = async (v, status) => {
    let note = ''
    if (status === 'rejected') {
      note = window.prompt('Reason for rejection (shown to the account):', '') || ''
    }
    const ok = await confirm({
      title: status === 'approved' ? 'Approve this document?' : 'Reject this document?',
      message: status === 'approved'
        ? `"${v.file_name}" will be approved — the ${v.kind} will be marked as verified.`
        : `"${v.file_name}" will be rejected${note ? ` with the note: "${note}"` : ''}. The ${v.kind} will stay unverified.`,
      confirmLabel: status === 'approved' ? 'Approve' : 'Reject',
      danger: status === 'rejected'
    })
    if (!ok) return
    try {
      await api(`/verify/all/${v.id}`, { method: 'PATCH', token, body: { status, note } })
      toast.success(`Document ${status}`)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const deleteVerification = async (id) => {
    const ok = await confirm({
      title: 'Delete this document record?',
      message: 'This verification document record will be permanently deleted.',
      confirmLabel: 'Delete'
    })
    if (!ok) return
    try {
      await api(`/verify/all/${id}`, { method: 'DELETE', token })
      toast.success('Document deleted')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const companies = data.companies || []
  const schools = data.schools || []
  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const pendingVerify = verifications.filter((v) => v.status === 'pending').length

  const requestInitial = (r) => {
    const d = r.details || {}
    if (r.kind === 'company') {
      return { companyName: d.company || '', industry: d.industry || '', name: d.contact || '', email: d.email || '', phone: d.phone || '', address: d.address || '' }
    }
    return { schoolName: d.school || '', name: d.coordinator || '', email: d.email || '', phone: d.phone || '', position: d.position || '' }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Admin Panel</h1>
          <p className="muted">Verify and manage company and school accounts. Only you can create them.</p>
        </div>
        {tab === 'companies' || tab === 'schools' ? (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add {tab === 'companies' ? 'company' : 'school'}</button>
        ) : null}
      </header>

      {loading ? (
        <Spinner label="Loading…" />
      ) : (
        <>
          <div className="seg admin-tabs">
            <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users ({users.length})</button>
            <button className={tab === 'companies' ? 'active' : ''} onClick={() => setTab('companies')}>Companies ({companies.length})</button>
            <button className={tab === 'schools' ? 'active' : ''} onClick={() => setTab('schools')}>Schools ({schools.length})</button>
            <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Requests ({pendingCount})</button>
            <button className={tab === 'verifications' ? 'active' : ''} onClick={() => setTab('verifications')}>Verifications ({pendingVerify})</button>
          </div>

          {tab === 'users' && (
            <UserList users={users} onDelete={deleteUser} />
          )}

          {tab === 'companies' && (
            companies.length === 0 ? (
              <div className="empty-state"><div className="empty-emoji">🏢</div><h3>No company accounts yet</h3><p>Add your first verified company.</p></div>
            ) : (
              <div className="admin-list">
                {companies.map((u) => (
                  <UserRow key={u.id} u={u} label="Company" onDelete={remove} />
                ))}
              </div>
            )
          )}

          {tab === 'schools' && (
            schools.length === 0 ? (
              <div className="empty-state"><div className="empty-emoji">🏫</div><h3>No school accounts yet</h3><p>Add the first school coordinator.</p></div>
            ) : (
              <div className="admin-list">
                {schools.map((u) => (
                  <UserRow key={u.id} u={u} label="School" onDelete={remove} />
                ))}
              </div>
            )
          )}

          {tab === 'requests' && (
            requests.length === 0 ? (
              <div className="empty-state"><div className="empty-emoji">📨</div><h3>No requests yet</h3><p>Requests from the "Chat with us" widget will appear here.</p></div>
            ) : (
              <div className="admin-list">
                {requests.map((r) => (
                  <RequestCard key={r.id} r={r} onStatus={setRequestStatus} onApprove={setApproveTarget} onDecline={declineRequest} onDelete={deleteRequest} />
                ))}
              </div>
            )
          )}

          {tab === 'verifications' && (
            verifications.length === 0 ? (
              <div className="empty-state"><div className="empty-emoji">🪪</div><h3>No verification documents yet</h3><p>Valid IDs and credentials uploaded by companies and schools will appear here.</p></div>
            ) : (
              <>
                <div className="admin-list">
                  {verifications.map((v) => (
                    <VerifyRow key={v.id} v={v} onReview={reviewVerification} onDelete={deleteVerification} />
                  ))}
                </div>
              </>
            )
          )}
        </>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={tab === 'companies' ? 'Create company account' : 'Create school account'}>
        {tab === 'companies' ? (
          <CompanyForm onDone={() => { setShowModal(false); load() }} />
        ) : (
          <SchoolForm onDone={() => { setShowModal(false); load() }} />
        )}
      </Modal>

      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title={approveTarget ? `Approve ${approveTarget.kind} request — create account` : ''}
      >
        {approveTarget && (approveTarget.kind === 'company' ? (
          <CompanyForm
            initial={requestInitial(approveTarget)}
            onDone={() => approveRequest(approveTarget)}
          />
        ) : (
          <SchoolForm
            initial={requestInitial(approveTarget)}
            onDone={() => approveRequest(approveTarget)}
          />
        ))}
      </Modal>
    </div>
  )
}