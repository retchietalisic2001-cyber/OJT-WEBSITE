import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { useConfirm } from '../../confirm.jsx'
import { api } from '../../api.js'
import { Spinner, emptyState, StatCard, StatusBadge, CourseBadge } from '../../components/ui.jsx'

export default function CompanyHome() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [postings, setPostings] = useState(null)
  const [verify, setVerify] = useState(null)

  useEffect(() => {
    api('/postings/my', { token }).then(setPostings).catch(() => setPostings([]))
    api('/verify/status', { token }).then(setVerify).catch(() => {})
  }, [token])

  if (!postings) return <Spinner />

  const unverified = verify ? !verify.verified : false

  const totalApps = postings.reduce((s, p) => s + (p.applicants_count || 0), 0)
  const totalAccepted = postings.reduce((s, p) => s + (p.accepted_count || 0), 0)
  const openCount = postings.filter((p) => p.status === 'open').length

  const toggleStatus = async (p) => {
    const next = p.status === 'open' ? 'closed' : 'open'
    const ok = await confirm({
      title: next === 'closed' ? 'Close this posting?' : 'Reopen this posting?',
      message: `"${p.title}" will be ${next === 'closed' ? 'closed — no new applicants can apply' : 'opened for new applicants again'}.`,
      confirmLabel: next === 'closed' ? 'Close posting' : 'Reopen'
    })
    if (!ok) return
    try {
      await api(`/postings/${p.id}/status`, { method: 'PATCH', token, body: { status: next } })
      setPostings((list) => list.map((x) => (x.id === p.id ? { ...x, status: next } : x)))
    } catch (e) {
      /* ignore */
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{user.profile?.company_name || 'Company'} admin</h1>
          <p className="muted">Post OJT openings and manage applicants all in one place.</p>
        </div>
        {unverified ? (
          <Link className="btn" to="/company/profile" title="Complete verification to post openings">Verify to post 📄</Link>
        ) : (
          <Link className="btn btn-primary" to="/company/postings/new">+ New posting</Link>
        )}
      </header>

      {unverified && (
        <div className="verify-banner unverified">
          ⚠️ Your company isn't verified yet. Upload a valid ID and your credentials/papers (SEC/DTI registration, permits)
          on your <Link className="link-btn" to="/company/profile">profile</Link> so applicants can trust your postings.
        </div>
      )}

      <div className="stats-grid">
        <StatCard icon="📋" label="Postings" value={postings.length} accent="#5B4BDB" />
        <StatCard icon="🟢" label="Open now" value={openCount} accent="#2FA86B" />
        <StatCard icon="🧑‍🎓" label="Total applicants" value={totalApps} accent="#2F80ED" />
        <StatCard icon="✅" label="Accepted interns" value={totalAccepted} accent="#D97706" />
      </div>

      <section className="mt">
        <div className="section-head">
          <h2>My postings</h2>
          <Link className="link-btn" to="/company/applications">View all applications →</Link>
        </div>

        {postings.length === 0 ? (
          <div className="card card-pad">
            {unverified
              ? emptyState(
                  'No postings yet',
                  'Verify your company first so you can post trusted OJT openings and get applicants.',
                  <Link className="btn" to="/company/profile">Verify to post 📄</Link>
                )
              : emptyState(
                  'No postings yet',
                  'Create your first OJT posting so applicants in your area can find you.',
                  <Link className="btn btn-primary" to="/company/postings/new">Create a posting</Link>
                )}
          </div>
        ) : (
          <div className="posting-cards">
            {postings.map((p) => (
              <div key={p.id} className="card posting-card">
                <div className="posting-card-top">
                  <div>
                    <h3>{p.title}</h3>
                    <span className="muted">{p.city}{p.address ? ` · ${p.address}` : ''}</span>
                  </div>
                  <span className={'status-pill ' + (p.status === 'open' ? 'open' : 'closed')}>
                    {p.status === 'open' ? '● Open' : '● Closed'}
                  </span>
                </div>
                <div className="job-tags">
                  {p.course_tags.map((t, i) => (
                    <CourseBadge key={t} tag={t} index={i} />
                  ))}
                </div>
                <div className="posting-card-stats">
                  <span><b>{p.applicants_count}</b> applicants</span>
                  <span><b>{p.slots}</b> slots</span>
                  <span><b>{p.accepted_count}</b> placed</span>
                </div>
                <div className="posting-card-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(p)}>
                    {p.status === 'open' ? 'Close posting' : 'Reopen'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/company/postings/${p.id}/edit`)}>Edit</button>
                  <Link className="btn btn-primary btn-sm" to={`/company/postings/${p.id}`}>View applicants →</Link>
                </div>
                {p.status === 'closed' && p.applicants_count > 0 && (
                  <p className="muted small">You can still chat with applicants who already applied.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}