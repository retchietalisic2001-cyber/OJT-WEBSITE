import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api } from '../../api.js'
import { Spinner, StatusBadge, StatCard, emptyState } from '../../components/ui.jsx'
import { useConfirm } from '../../confirm.jsx'
import { toast } from '../../toast.jsx'

function StudentRow({ x, schoolId, onUntrack }) {
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

export default function SchoolHome() {
  const { token, user } = useAuth()
  const confirm = useConfirm()
  const [data, setData] = useState(null)
  const [verify, setVerify] = useState(null)
  const [error, setError] = useState(null)

  const [newCourse, setNewCourse] = useState('')
  const [roomDrafts, setRoomDrafts] = useState({})

  const [addForm, setAddForm] = useState({ studentId: '', name: '', courseId: '', roomId: '' })
  const [addBusy, setAddBusy] = useState(false)

  const [placeSel, setPlaceSel] = useState({})
  const [sel, setSel] = useState('unassigned')

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
    if (!addForm.courseId || !addForm.roomId) return toast.error('Pick a course and a room')
    setAddBusy(true)
    try {
      const r = await api('/schools/enrollments', { method: 'POST', token, body: addForm })
      toast.success(r.message)
      setAddForm({ studentId: '', name: '', courseId: '', roomId: '' })
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAddBusy(false)
    }
  }

  const assignStudent = async (x) => {
    const sel = placeSel[x.user_id] || {}
    if (!sel.courseId || !sel.roomId) return toast.error('Pick a course and a room to assign')
    try {
      const r = await api('/schools/enrollments/place', {
        method: 'POST',
        token,
        body: { userId: x.user_id, courseId: sel.courseId, roomId: sel.roomId }
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

  const roomsOf = (courseId) => courses.find((c) => c.id === courseId)?.rooms || []

  const unverified = verify ? !verify.verified : false

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-inline">
          {user.profile?.logo && <div className="school-logo"><img src={user.profile.logo} alt={schoolName || 'School'} /></div>}
          <div>
            <h1>{schoolName || 'School'} · OJT monitoring</h1>
            <p className="muted">Organize students by course → room. Add them by Student ID so nobody gets mixed up between schools, courses, or rooms.</p>
          </div>
        </div>
      </header>

      {unverified && (
        <div className="verify-banner unverified">
          ⚠️ Your school account isn't verified yet. Upload a valid ID and your school credentials/papers (CHED permit, registration)
          on your <Link className="link-btn" to="/school/profile">profile</Link> to confirm this school is legitimate.
        </div>
      )}

      <div className="stats-grid">
        <StatCard icon="🧑‍🎓" label="Students tracked" value={d.total_active} accent="#5B4BDB" />
        <StatCard icon="🪪" label="Invited (waiting to register)" value={d.total_invited} accent="#D97706" />
        <StatCard icon="✅" label="Found a company" value={withApp} accent="#2FA86B" />
        <StatCard icon="🎉" label="Placed (accepted)" value={placed} accent="#2F80ED" />
      </div>

      <div className="school-manage-grid">
        <div className="card card-pad">
          <h3>📚 Courses &amp; Rooms</h3>
          <p className="muted small">Create the courses your school offers, then add rooms (sections) inside each course.</p>
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
                      🚪 {r.name}
                      <button className="pill-x" onClick={() => deleteRoom(r)} title="Delete room">✕</button>
                    </span>
                  ))}
                  {c.rooms.length === 0 && <span className="muted small">No rooms yet.</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <h3>➕ Add a student by Student ID</h3>
          <p className="muted small">
            Type the student's school-issued ID. If they already registered with that ID, they are placed right away.
            Otherwise they are listed as <em>invited</em> and are placed automatically the moment they register with this ID.
          </p>
          <form className="add-student-form" onSubmit={addStudent}>
            <label className="field">
              <span className="field-label">Student / School ID *</span>
              <input className="input" placeholder="e.g. 2025-00123" value={addForm.studentId} onChange={(e) => set('studentId', e.target.value)} required />
            </label>
            <label className="field">
              <span className="field-label">Student name <em className="muted">(optional)</em></span>
              <input className="input" placeholder="Only needed if they haven't registered yet" value={addForm.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <div className="form-grid two">
              <label className="field">
                <span className="field-label">Course *</span>
                <select className="input" value={addForm.courseId} onChange={(e) => { set('courseId', e.target.value); set('roomId', '') }} required>
                  <option value="">— select —</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Room *</span>
                <select className="input" value={addForm.roomId} onChange={(e) => set('roomId', e.target.value)} required>
                  <option value="">— select —</option>
                  {roomsOf(addForm.courseId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={addBusy}>
              {addBusy ? 'Adding…' : '➕ Track this student'}
            </button>
          </form>
        </div>
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
          </div>
        </aside>

        <div className="school-main">
          {selCourse && (
            <section>
              <div className="section-head">
                <h2>📘 {selCourse.name}</h2>
                <span className="muted">{selCourse.active_count} tracked · {selCourse.invited_count} invited</span>
              </div>
              {selCourse.rooms.map((r) => (
                <div className="card table-card mt" key={r.id}>
                  <div className="section-head">
                    <h3>🚪 {r.name}</h3>
                    <span className="muted">{r.students.length} placed{r.invited.length ? ` · ${r.invited.length} invited` : ''}</span>
                  </div>
                  <table className="table">
                    <thead>
                      <tr><th>Student</th><th>Applications</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                      {(r.invited || []).map((x) => <StudentRow key={`i${x.enrollment_id}`} x={x} onUntrack={untrack} />)}
                      {(r.students || []).map((x) => <StudentRow key={x.enrollment_id} x={x} onUntrack={untrack} />)}
                      {r.students.length === 0 && r.invited.length === 0 && (
                        <tr><td colSpan="4" className="muted">No students in this room yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
              {selCourse.rooms.length === 0 && <div className="card card-pad muted">No rooms yet in this course — add rooms in "Courses &amp; Rooms" above.</div>}
            </section>
          )}

          {!selCourse && (
            <section>
              <div className="section-head">
                <h2>🗂️ Unassigned students</h2>
                <span className="muted">{unassigned.length} — assigned to your school but not yet placed in a course &amp; room</span>
              </div>
              <div className="card table-card">
                <table className="table">
                  <thead>
                    <tr><th>Student</th><th>Applications</th><th>Status</th><th>Assign to course &amp; room</th></tr>
                  </thead>
                  <tbody>
                    {unassigned.length === 0 && <tr><td colSpan="4" className="muted">Nothing to assign — every student is placed.</td></tr>}
                    {unassigned.map((x) => (
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
                          {x.latest_status ? <StatusBadge status={x.latest_status} /> : <span className="muted">Not applied</span>}
                          {!x.user_id && <span className="req-badge pending ml small">Invited</span>}
                        </td>
                        <td>
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
                          {x.enrollment_id && x.user_id && (
                            <button className="btn btn-sm btn-danger mt" onClick={() => untrack(x)}>Untrack</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}