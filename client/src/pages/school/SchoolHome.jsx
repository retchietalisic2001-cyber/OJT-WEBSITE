import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api } from '../../api.js'
import { Spinner, StatusBadge, StatCard, emptyState } from '../../components/ui.jsx'
import { useConfirm } from '../../confirm.jsx'
import { toast } from '../../toast.jsx'

function StudentRow({ x, schoolId, onUntrack, unread = 0 }) {
  return (
    <tr>
      <td>
        <div className="cell-user">
          {x.user_id ? (
            <div className="avatar sm">{String(x.name || '?').charAt(0).toUpperCase()}</div>
          ) : (
            <div className="avatar sm ghost">🕐</div>
          )}
          <div>
            <strong>{x.user_id ? x.name : (x.name || 'Waiting for registration')}</strong>
            <span className="muted small">
              🪪 {x.student_id || x.profile_student_id || '—'}
              {x.email ? ` · ${x.email}` : ''}
            </span>
          </div>
        </div>
      </td>
      <td>
        {x.status === 'invited' ? (
          <span className="req-badge pending">Invited — waiting to register</span>
        ) : (
          <>
            <b>{x.applications_count || 0}</b>
            <span className="muted small"> applications</span>
          </>
        )}
      </td>
      <td>
        {x.latest_status ? <StatusBadge status={x.latest_status} /> : <span className="muted">Not applied</span>}
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {unread > 0 && (
          <Link className="chat-chip" to={`/school/messages?student=${x.user_id}`}>
            💬 {unread}
          </Link>
        )}
        {x.user_id && (
          <Link className="link-btn" to={`/school/students/${x.user_id}`}>View →</Link>
        )}
        {onUntrack && (
          <button className="btn btn-sm btn-danger ml" onClick={() => onUntrack(x)}>Untrack</button>
        )}
      </td>
    </tr>
  )
}

const TABS = [
  { key: 'overview', icon: '📊', label: 'Overview' },
  { key: 'students', icon: '🧑‍🎓', label: 'Students' },
  { key: 'structure', icon: '📚', label: 'Courses & Rooms' }
]

export default function SchoolHome() {
  const { token, user } = useAuth()
  const confirm = useConfirm()
  const [data, setData] = useState(null)
  const [verify, setVerify] = useState(null)
  const [error, setError] = useState(null)
  const [threads, setThreads] = useState([])

  const [tab, setTab] = useState('overview')
  const [newCourse, setNewCourse] = useState('')
  const [roomDrafts, setRoomDrafts] = useState({})

  const [addForm, setAddForm] = useState({ studentId: '', email: '', name: '', courseId: '', roomId: '' })
  const [addBusy, setAddBusy] = useState(false)

  const [searchQ, setSearchQ] = useState('')
  const [searchRes, setSearchRes] = useState(null)
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchPick, setSearchPick] = useState({})

  const [placeSel, setPlaceSel] = useState({})
  const [sel, setSel] = useState('unassigned')
  const [openRooms, setOpenRooms] = useState({})

  const load = async () => {
    try {
      const d = await api('/schools/enrollments', { token })
      setData(d)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load().catch(() => {})
    api('/verify/status', { token }).then(setVerify).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    let alive = true
    const loadThreads = () =>
      api('/chat/school-threads', { token })
        .then((r) => alive && setThreads(r.threads || []))
        .catch(() => {})
    loadThreads()
    const t = setInterval(loadThreads, 15000)
    const onFocus = () => loadThreads()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [token])

  useEffect(() => {
    const all = data?.courses || []
    if (sel !== 'unassigned' && !all.some((c) => c.id === sel)) setSel('unassigned')
  }, [data, sel])

  if (!data && !error) return <Spinner />

  const blockTracking = verify && !verify.verified && verify.pendingCount === 0
  if (blockTracking) {
    return (
      <div className="page">
        <div className="card card-pad">
          {emptyState(
            '🔒 Verification required',
            "Your school must be verified to track students' OJT progress. Upload a valid ID and your school credentials/papers (CHED permit, registration) on your profile.",
            <Link className="btn btn-primary" to="/school/profile">Go to verification</Link>
          )}
        </div>
      </div>
    )
  }

  if (error) return <div className="card card-pad">{emptyState('No school linked', 'Link your school in your profile so you can monitor its students.', <Link className="btn btn-primary" to="/school/profile">Link my school</Link>)}</div>

  const d = data
  const schoolName = user.profile?.school_name || d.school_name
  const courses = d.courses || []
  const unassigned = [...(d.unassigned || []), ...(d.legacy || [])]
  const selCourse = courses.find((c) => c.id === sel) || null

  const allStudents = courses.flatMap((c) => c.rooms.flatMap((r) => r.students))
  const withApp = allStudents.filter((s) => (s.applications_count || 0) > 0).length
  const placed = allStudents.filter((s) => s.latest_status === 'accepted').length
  const totalStudents = d.total_active + d.total_invited
  const unreadMap = Object.fromEntries(threads.map((t) => [t.studentId, t.unread]))

  const set = (k, v) => setAddForm((f) => ({ ...f, [k]: v }))

  const addCourse = async (e) => {
    e.preventDefault()
    if (!newCourse.trim()) return
    try {
      await api('/schools/courses', { method: 'POST', token, body: { name: newCourse } })
      setNewCourse('')
      toast.success('Course added')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const addRoom = async (courseId) => {
    const name = (roomDrafts[courseId] || '').trim()
    if (!name) return
    try {
      await api(`/schools/courses/${courseId}/rooms`, { method: 'POST', token, body: { name } })
      setRoomDrafts((r) => ({ ...r, [courseId]: '' }))
      toast.success('Room added')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const deleteCourse = async (c) => {
    const ok = await confirm({ title: `Delete "${c.name}"?`, message: 'This deletes all rooms under it. Students already tracked must be moved first.', confirmLabel: 'Delete course', danger: true })
    if (!ok) return
    try {
      await api(`/schools/courses/${c.id}`, { method: 'DELETE', token })
      toast.success('Course deleted')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const deleteRoom = async (r) => {
    const ok = await confirm({ title: `Delete room "${r.name}"?`, message: 'Move tracked students out of this room first.', confirmLabel: 'Delete room', danger: true })
    if (!ok) return
    try {
      await api(`/schools/rooms/${r.id}`, { method: 'DELETE', token })
      toast.success('Room deleted')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const addStudent = async (e) => {
    e.preventDefault()
    if (!addForm.studentId.trim()) return toast.error('Student ID is required')
    if (!/^\S+@\S+\.\S+$/.test(addForm.email.trim())) return toast.error('Enter the student\'s email')
    setAddBusy(true)
    try {
      const r = await api('/schools/enrollments', { method: 'POST', token, body: addForm })
      toast.success(r.message)
      setAddForm({ studentId: '', email: '', name: '', courseId: '', roomId: '' })
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAddBusy(false)
    }
  }

  const runSearch = async () => {
    const q = searchQ.trim()
    if (!q) return toast.error('Type a name, Student ID, or email to search')
    setSearchBusy(true)
    try {
      const r = await api(`/schools/enrollments/search?q=${encodeURIComponent(q)}`, { token })
      setSearchRes(r.results || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSearchBusy(false)
    }
  }

  const placeSearchStudent = async (s) => {
    const key = s.enrollment_id ? `e${s.enrollment_id}` : `u${s.user_id}`
    const sel = searchPick[key] || {}
    if (!sel.courseId || !sel.roomId) return toast.error('Pick a course and a room to place this student')
    setSearchBusy(true)
    try {
      const body = { courseId: sel.courseId, roomId: sel.roomId }
      if (s.enrollment_id) body.enrollmentId = s.enrollment_id
      else if (s.user_id) body.userId = s.user_id
      else return toast.error('This student cannot be placed yet')
      const r = await api('/schools/enrollments/place', { method: 'POST', token, body })
      toast.success(r.message)
      setSearchPick({})
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSearchBusy(false)
    }
  }

  const assignStudent = async (x) => {
    const selAssign = placeSel[x.user_id] || {}
    if (!selAssign.courseId || !selAssign.roomId) return toast.error('Pick a course and a room to assign')
    try {
      const r = await api('/schools/enrollments/place', {
        method: 'POST',
        token,
        body: { userId: x.user_id, courseId: selAssign.courseId, roomId: selAssign.roomId }
      })
      toast.success(r.message)
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const untrack = async (x) => {
    const ok = await confirm({
      title: `Stop tracking ${x.name || x.student_id}?`,
      message: 'This removes their course/room placement from your school. You can add them again any time.',
      confirmLabel: 'Remove',
      danger: true
    })
    if (!ok) return
    try {
      await api(`/schools/enrollments/${x.enrollment_id}`, { method: 'DELETE', token })
      toast.success('Student removed')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const reinvite = async (x) => {
    try {
      const r = await api(`/schools/enrollments/${x.enrollment_id}/reinvite`, { method: 'POST', token })
      toast.success(r.message)
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const inviteState = (x) => {
    if (x.invite_action === 'declined') return 'declined'
    if (x.invite_action === 'accepted') return 'accepted'
    return 'pending'
  }

  const assignable = (x) => !x.enrollment_id || x.status === 'active' || inviteState(x) === 'accepted'

  const roomsOf = (courseId) => courses.find((c) => Number(c.id) === Number(courseId))?.rooms || []

  const searchResultKey = (s) => (s.enrollment_id ? `e${s.enrollment_id}` : `u${s.user_id}`)

  const searchStatus = (s) => {
    if (s.invite_action === 'declined') return { label: 'Declined', cls: 'req-badge rejected' }
    if (s.status === 'invited' && s.invite_action === 'accepted') return { label: 'Accepted — ready to assign', cls: 'req-badge approved' }
    if (s.status === 'invited') return { label: 'Invited — awaiting acceptance', cls: 'req-badge pending' }
    if (s.status === 'active') return { label: 'Tracked', cls: 'req-badge approved' }
    return { label: 'Registered', cls: 'req-badge' }
  }

  const toggleRoom = (roomId) => setOpenRooms((o) => ({ ...o, [roomId]: !o[roomId] }))

  const openRoom = (courseId, roomId) => {
    setSel(String(courseId))
    setOpenRooms((o) => ({ ...o, [roomId]: true }))
    setTab('students')
    setTimeout(() => {
      document.getElementById('room-' + roomId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const unverified = verify ? !verify.verified : false

  return (
    <div className="page page-school">
      <header className="page-head">
        <div className="page-head-inline">
          {user.profile?.logo && <div className="school-logo"><img src={user.profile.logo} alt={schoolName || 'School'} /></div>}
          <div>
            <h1>{schoolName || 'School'} · OJT monitoring</h1>
            <p className="muted">Invite students by school ID + email, wait for them to accept, then assign their course &amp; room.</p>
          </div>
        </div>
      </header>

      {unverified && (
        <div className="verify-banner unverified">
          ⚠️ Your school account isn't verified yet. Upload a valid ID and your school credentials/papers (CHED permit, registration)
          on your <Link className="link-btn" to="/school/profile">profile</Link> to confirm this school is legitimate.
        </div>
      )}

      <div className="seg school-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
            {t.key === 'students' && totalStudents > 0 && <span className="tab-count">{totalStudents}</span>}
            {t.key === 'structure' && courses.length > 0 && <span className="tab-count">{courses.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="stats-grid">
            <StatCard icon="🧑‍🎓" label="Students tracked" value={d.total_active} accent="#5B4BDB" />
            <StatCard icon="🪪" label="Awaiting student's acceptance" value={d.pending_invited} accent="#D97706" />
            <StatCard icon="✅" label="Accepted — ready to assign" value={d.accepted_invited} accent="#2FA86B" />
            <StatCard icon="🙅" label="Declined" value={d.declined_invited} accent="#DB4B4B" />
          </div>

          <div className="school-manage-grid">
            <div className="card card-pad">
              <h3>➕ Invite a student</h3>
              <p className="muted small">
                Invite your student with their <strong>School ID + email</strong>. They'll get a prompt on their dashboard to
                <strong> accept</strong> your invitation — then you assign them to a specific course and room from the
                <strong> Students</strong> tab.
              </p>
              <form className="add-student-form" onSubmit={addStudent}>
                <div className="form-grid two">
                  <label className="field">
                    <span className="field-label">Student / School ID *</span>
                    <input className="input" placeholder="e.g. 2025-00123" value={addForm.studentId} onChange={(e) => set('studentId', e.target.value)} required />
                  </label>
                  <label className="field">
                    <span className="field-label">Student email *</span>
                    <input className="input" type="email" placeholder="their@email.com" value={addForm.email} onChange={(e) => set('email', e.target.value)} required />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Student name <em className="muted">(optional)</em></span>
                  <input className="input" placeholder="Only needed if they haven't registered yet" value={addForm.name} onChange={(e) => set('name', e.target.value)} />
                </label>
                <button className="btn btn-primary btn-block" type="submit" disabled={addBusy}>
                  {addBusy ? 'Sending…' : '➕ Send invitation'}
                </button>
              </form>
            </div>

            <div className="card card-pad">
              <h3>⚡ Quick overview</h3>
              <p className="muted small">What needs your attention right now.</p>
              <div className="quick-rows">
                <div className="quick-row">
                  <span>🟡 Awaiting student's acceptance</span>
                  <button className="link-btn" onClick={() => setTab('students')}>{d.pending_invited}</button>
                </div>
                <div className="quick-row">
                  <span>✅ Accepted — ready to assign</span>
                  <button className="link-btn" onClick={() => setTab('students')}>{d.accepted_invited}</button>
                </div>
                <div className="quick-row">
                  <span>📚 Courses set up</span>
                  <button className="link-btn" onClick={() => setTab('structure')}>{courses.length}</button>
                </div>
              </div>
              {courses.length === 0 && (
                <p className="muted small mt">You haven't created any courses yet — set up your structure first.</p>
              )}
              <div className="quick-actions">
                <button className="btn btn-ghost" onClick={() => setTab('students')}>Manage students →</button>
                <button className="btn btn-ghost" onClick={() => setTab('structure')}>{courses.length ? 'Edit courses & rooms →' : 'Set up courses →'}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'students' && (
        <>
          <div className="card card-pad search-panel">
            <h3>🔎 Search &amp; place students</h3>
            <p className="muted small">Find any of your students by name, Student ID, or email — then put them into their specific course and room.</p>
            <div className="inline-form">
              <input
                className="input"
                placeholder="Name, Student ID, or email…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              />
              <button className="btn btn-ghost" onClick={runSearch} disabled={searchBusy}>{searchBusy ? 'Searching…' : 'Search'}</button>
            </div>
            {searchRes === null && <p className="muted small mt">Try searching for a student to place or move them.</p>}
            {searchRes !== null && searchRes.length === 0 && <p className="muted small mt">No students match "{searchQ}".</p>}
            {searchRes && searchRes.length > 0 && (
              <div className="search-results">
                {searchRes.map((s) => {
                  const key = searchResultKey(s)
                  const pick = searchPick[key] || {}
                  const st = searchStatus(s)
                  const placed = s.course_name && s.room_name ? `${s.course_name} → ${s.room_name}` : ''
                  return (
                    <div className="search-result-row" key={key}>
                      <div className="cell-user grow">
                        <div className="avatar sm">{String(s.name || '?').charAt(0).toUpperCase()}</div>
                        <div>
                          <strong>{s.name || 'Waiting for registration'}</strong>
                          <span className="muted small">
                            🪪 {s.student_id || '—'}{s.email || s.user_email ? ` · ${s.email || s.user_email}` : ''}
                          </span>
                          <div className="muted small">
                            <span className={st.cls}>{st.label}</span>
                            {placed ? <span> · placed in <b>{placed}</b></span> : <span> · not placed</span>}
                          </div>
                        </div>
                      </div>
                      <div className="search-place">
                        <select className="input" value={pick.courseId || ''} onChange={(e) => setSearchPick((p) => ({ ...p, [key]: { ...p[key], courseId: e.target.value, roomId: '' } }))}>
                          <option value="">— course —</option>
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className="input" value={pick.roomId || ''} disabled={!pick.courseId} onChange={(e) => setSearchPick((p) => ({ ...p, [key]: { ...p[key], roomId: e.target.value } }))}>
                          <option value="">— room —</option>
                          {roomsOf(pick.courseId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={() => placeSearchStudent(s)} disabled={searchBusy}>Place</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        <div className="school-body-grid">
          <aside className="school-sidebar">
            <div className="card card-pad sidebar-card">
              <div className="sidebar-label">Students</div>
              <nav className="sidebar-nav">
                <button className={`sidebar-item ${sel === 'unassigned' ? 'active' : ''}`} onClick={() => setSel('unassigned')}>
                  <span>🗂️ Unassigned</span>
                  <span className="side-count">{unassigned.length}</span>
                </button>
              </nav>
              <div className="sidebar-label">Courses</div>
              <nav className="sidebar-nav">
                {courses.length === 0 && <p className="muted small">No courses yet — create one in "Courses &amp; Rooms".</p>}
                {courses.map((c) => (
                  <button key={c.id} className={`sidebar-item ${sel === c.id ? 'active' : ''}`} onClick={() => setSel(c.id)}>
                    <span>📘 {c.name}</span>
                    <span className="side-count" title={`${c.active_count} tracked · ${c.invited_count} invited`}>{c.active_count}{c.invited_count > 0 ? `+${c.invited_count}` : ''}</span>
                  </button>
                ))}
              </nav>
              <p className="sb-hint muted small">Pick a course or Unassigned to view and place students.</p>
            </div>
          </aside>

          <div className="school-main">
            {selCourse && (
              <section>
                <div className="section-head">
                  <h2>📘 {selCourse.name}</h2>
                  <span className="muted">{selCourse.active_count} tracked · {selCourse.invited_count} invited</span>
                </div>
                {selCourse.rooms.map((r) => {
                  const isOpen = openRooms[r.id] !== false
                  return (
                    <div className="card table-card mt" id={'room-' + r.id} key={r.id}>
                      <button className="section-head room-head" onClick={() => toggleRoom(r.id)} title={isOpen ? 'Collapse room' : 'Open room'}>
                        <h3>🚪 {r.name} <span className="room-caret">{isOpen ? '▾' : '▸'}</span></h3>
                        <span className="muted">{r.students.length} placed{r.invited.length ? ` · ${r.invited.length} invited` : ''}</span>
                      </button>
                      {isOpen && (
                        <table className="table">
                          <thead>
                            <tr><th>Student</th><th>Applications</th><th>Status</th><th></th></tr>
                          </thead>
                          <tbody>
                            {(r.invited || []).map((x) => <StudentRow key={`i${x.enrollment_id}`} x={x} onUntrack={untrack} unread={unreadMap[x.user_id] || 0} />)}
                            {(r.students || []).map((x) => <StudentRow key={x.enrollment_id} x={x} onUntrack={untrack} unread={unreadMap[x.user_id] || 0} />)}
                            {r.students.length === 0 && r.invited.length === 0 && (
                              <tr><td colSpan="4" className="muted">No students in this room yet.</td></tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                })}
                {selCourse.rooms.length === 0 && <div className="card card-pad muted">No rooms yet in this course — add rooms in "Courses &amp; Rooms".</div>}
              </section>
            )}

            {!selCourse && (
              <section>
                <div className="section-head">
                  <h2>🗂️ Unassigned students</h2>
                  <span className="muted">{unassigned.length} — invited students waiting to accept, or accepted students ready to be placed in a course &amp; room</span>
                </div>
                <div className="card table-card">
                  <table className="table">
                    <thead>
                      <tr><th>Student</th><th>Applications</th><th>Status</th><th>Assign to course &amp; room</th></tr>
                    </thead>
                    <tbody>
                      {unassigned.length === 0 && <tr><td colSpan="4" className="muted">Nothing to assign — every student is placed.</td></tr>}
                      {unassigned.map((x) => {
                        const st = inviteState(x)
                        return (
                        <tr key={`u${x.enrollment_id || `l${x.user_id}`}`}>
                          <td>
                            <div className="cell-user">
                              <div className="avatar sm">{String(x.name || '?').charAt(0).toUpperCase()}</div>
                              <div>
                                <strong>{x.name}</strong>
                                <span className="muted small">🪪 {x.student_id || x.profile_student_id || '—'}{x.email ? ` · ${x.email}` : ''}</span>
                              </div>
                            </div>
                          </td>
                          <td><b>{x.applications_count || 0}</b></td>
                          <td>
                            {st === 'pending' && <span className="req-badge pending">{x.user_id ? 'Awaiting accept — registered' : 'Awaiting accept — emailed'}</span>}
                            {st === 'accepted' && <span className="req-badge approved">Accepted — ready to assign</span>}
                            {st === 'declined' && <span className="req-badge rejected">Declined</span>}
                            {!x.enrollment_id && <span className="req-badge approved">Linked · ready</span>}
                            <div className="muted small">{x.latest_status ? <StatusBadge status={x.latest_status} /> : 'Not applied'}</div>
                          </td>
                          <td>
                            {unreadMap[x.user_id] > 0 && (
                              <div className="mb"><Link className="chat-chip" to={`/school/messages?student=${x.user_id}`}>💬 {unreadMap[x.user_id]} unread</Link></div>
                            )}
                            {assignable(x) && (
                              <div className="inline-form">
                                <select className="input" value={placeSel[x.user_id]?.courseId || ''} onChange={(e) => setPlaceSel((s) => ({ ...s, [x.user_id]: { courseId: e.target.value, roomId: '' } }))}>
                                  <option value="">— course —</option>
                                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <select className="input" value={placeSel[x.user_id]?.roomId || ''} disabled={!placeSel[x.user_id]?.courseId} onChange={(e) => setPlaceSel((s) => ({ ...s, [x.user_id]: { courseId: s[x.user_id]?.courseId, roomId: e.target.value } }))}>
                                  <option value="">— room —</option>
                                  {roomsOf(placeSel[x.user_id]?.courseId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <button className="btn btn-ghost" onClick={() => assignStudent(x)}>Assign</button>
                              </div>
                            )}
                            {st === 'pending' && <span className="muted small">Assigning unlocks once they accept in the app.</span>}
                            {st === 'declined' && (
                              x.enrollment_id ? (
                                <button className="btn btn-sm btn-ghost" onClick={() => reinvite(x)}>↻ Re-invite</button>
                              ) : null
                            )}
                            {x.enrollment_id && x.user_id && (
                              <button className="btn btn-sm btn-danger mt" onClick={() => untrack(x)}>Untrack</button>
                            )}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
        </>
      )}

      {tab === 'structure' && (
        <div className="card card-pad">
          <h3>📚 Courses &amp; Rooms</h3>
          <p className="muted small">Create the courses your school offers, then add rooms (sections) inside each course. Editing your structure never deletes students — just their placeholders.</p>
          <form className="inline-form" onSubmit={addCourse}>
            <input className="input" placeholder="e.g. Bachelor of Science in Computer Science" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} />
            <button className="btn btn-primary" type="submit">+ Add course</button>
          </form>
          <div className="course-list">
            {courses.length === 0 && <p className="muted small">No courses yet — add your first course above.</p>}
            {courses.map((c) => (
              <div className="course-card" key={c.id}>
                <div className="course-head">
                  <strong>{c.name}</strong>
                  <span className="muted small">{c.active_count} tracked · {c.invited_count} invited</span>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteCourse(c)}>✕</button>
                </div>
                <div className="inline-form">
                  <input className="input" placeholder="Room / section name (e.g. 3A, Room 204…)" value={roomDrafts[c.id] || ''} onChange={(e) => setRoomDrafts((r) => ({ ...r, [c.id]: e.target.value }))} />
                  <button className="btn btn-ghost" onClick={() => addRoom(c.id)}>+ Room</button>
                </div>
                <div className="room-pills">
                  {c.rooms.map((r) => (
                    <span className="room-pill" key={r.id}>
                      <button className="pill-open" onClick={() => openRoom(c.id, r.id)} title="Open room — view students">
                        🚪 {r.name}
                      </button>
                      <button className="pill-x" onClick={() => deleteRoom(r)} title="Delete room">✕</button>
                    </span>
                  ))}
                  {c.rooms.length === 0 && <span className="muted small">No rooms yet.</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}