import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api, fmtDate } from '../../api.js'
import { Spinner, StatusBadge, Timeline, emptyState } from '../../components/ui.jsx'
import ChatBox from '../../components/ChatBox.jsx'
import { useConfirm } from '../../confirm.jsx'
import { toast } from '../../toast.jsx'

export default function StudentDetail() {
  const { id } = useParams()
  const { token } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [stu, setStu] = useState(null)
  const [verify, setVerify] = useState(null)

  useEffect(() => {
    api(`/schools/students/${id}`, { token }).then(setStu).catch(() => setStu({ error: true }))
    api('/verify/status', { token }).then(setVerify).catch(() => {})
  }, [id, token])

  if (!stu) return <Spinner />

  if (verify && !verify.verified && verify.pendingCount === 0) {
    return (
      <div className="page">
        <div className="card card-pad">
          {emptyState(
            '🔒 Verification required',
            "Your school must be verified to view students' OJT progress. Upload your documents on your profile.",
            <Link className="btn btn-primary" to="/school/profile">Go to verification</Link>
          )}
        </div>
      </div>
    )
  }

  if (stu.error) return <div className="card card-pad">{emptyState('Student not found')}</div>

  const untrack = async () => {
    if (!stu.enrollment_id) return toast.error('This student is not in a tracked course/room yet')
    const ok = await confirm({
      title: `Stop tracking ${stu.name}?`,
      message: 'This removes their course/room placement from your school.',
      confirmLabel: 'Remove',
      danger: true
    })
    if (!ok) return
    try {
      await api(`/schools/enrollments/${stu.enrollment_id}`, { method: 'DELETE', token })
      toast.success('Student removed')
      navigate('/school')
    } catch (err) {
      toast.error(err.message)
    }
  }

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

          <div className="card card-pad mt">
            <div className="section-head">
              <div>
                <h3>💬 Chat with {stu.name.split(' ')[0] || stu.name}</h3>
                <span className="muted small">Send follow-up requests — documents, reminders, or updates.</span>
              </div>
            </div>
            <ChatBox thread={{ type: 'school', studentId: Number(id) }} title={stu.name} />
          </div>
        </div>

        <div className="detail-side">
          {stu.enrollment_id && (
            <div className="card card-pad">
              <h3>🗂️ Placement</h3>
              <div className="placement-info">
                <p><span>Student ID</span><strong>🪪 {stu.student_id || '—'}</strong></p>
                <p><span>Course</span><strong>{stu.enrolled_course || 'Unassigned'}</strong></p>
                <p><span>Room</span><strong>{stu.enrolled_room || '—'}</strong></p>
              </div>
              <button className="btn btn-sm btn-danger btn-block mt" onClick={untrack}>Remove from tracking</button>
            </div>
          )}
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