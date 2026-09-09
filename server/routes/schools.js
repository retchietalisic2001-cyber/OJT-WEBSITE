import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { isVerified } from './verify.js'

const router = Router()

export async function matchEnrollmentByStudentId(userId, studentId) {
  const sid = String(studentId || '').trim()
  if (!sid) return null
  const e = await get(
    `SELECT e.* FROM enrollments e WHERE e.status = 'invited' AND e.user_id IS NULL AND lower(e.student_id) = lower(?) LIMIT 1`,
    sid
  )
  if (!e) return null
  await run("UPDATE enrollments SET user_id = ?, status = 'active' WHERE id = ?", userId, e.id)
  const ap = await get('SELECT school_id FROM applicant_profiles WHERE user_id = ?', userId)
  if (ap && !ap.school_id && e.school_id) {
    await run('UPDATE applicant_profiles SET school_id = ? WHERE user_id = ?', e.school_id, userId)
  }
  return e
}

router.get('/', async (req, res) => {
  const schools = await all('SELECT id, name FROM schools ORDER BY lower(name)')
  res.json(schools)
})

router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'School name is required' })
  let school = await get('SELECT * FROM schools WHERE lower(name) = lower(?)', name)
  if (!school) {
    const id = await run('INSERT INTO schools (name) VALUES (?)', name)
    school = { id, name }
  }
  res.status(201).json(school)
})

async function coordinatorSchool(userId) {
  const coord = await get('SELECT * FROM school_coordinators WHERE user_id = ?', userId)
  return coord?.school_id ?? null
}

async function canTrackStudents(userId) {
  const rows = await all('SELECT status FROM verifications WHERE user_id = ?', userId)
  return (await isVerified(userId)) || rows.some((v) => v.status === 'pending')
}

router.get('/stats', requireAuth, requireRole('school'), async (req, res) => {
  if (!(await canTrackStudents(req.user.id)))
    return res.status(403).json({ error: 'Verify your school account before tracking students. Upload your documents in your profile.' })
  const schoolId = await coordinatorSchool(req.user.id)
  if (!schoolId) return res.status(400).json({ error: 'Your school account is not linked to any school yet' })

  const students = await all(
    `SELECT u.id, u.name, u.email, u.created_at, ap.course, ap.year_level, ap.phone,
            (SELECT COUNT(*) FROM applications a WHERE a.applicant_id = u.id) AS applications_count,
            (SELECT a.status FROM applications a WHERE a.applicant_id = u.id ORDER BY a.updated_at DESC LIMIT 1) AS latest_status
     FROM users u JOIN applicant_profiles ap ON ap.user_id = u.id
     WHERE ap.school_id = ?
     ORDER BY u.name`,
    schoolId
  )

  const statusCounts = { submitted: 0, under_review: 0, interview: 0, accepted: 0, rejected: 0, withdrawn: 0 }
  let withApplication = 0
  for (const s of students) {
    if (s.applications_count > 0) withApplication++
    if (s.latest_status && (s.latest_status in statusCounts)) statusCounts[s.latest_status]++
  }

  res.json({
    school_id: schoolId,
    total_students: students.length,
    with_application: withApplication,
    without_application: students.length - withApplication,
    placed: statusCounts.accepted,
    in_progress: statusCounts.submitted + statusCounts.under_review + statusCounts.interview,
    status_counts: statusCounts,
    students
  })
})

router.get('/students', requireAuth, requireRole('school'), async (req, res) => {
  if (!(await canTrackStudents(req.user.id)))
    return res.status(403).json({ error: 'Verify your school account before tracking students. Upload your documents in your profile.' })
  const schoolId = await coordinatorSchool(req.user.id)
  if (!schoolId) return res.status(400).json({ error: 'Your school account is not linked to any school yet' })

  const students = await all(
    `SELECT u.id, u.name, u.email, ap.course, ap.year_level, ap.phone,
            (SELECT COUNT(*) FROM applications a WHERE a.applicant_id = u.id) AS applications_count,
            (SELECT a.status FROM applications a WHERE a.applicant_id = u.id ORDER BY a.updated_at DESC LIMIT 1) AS latest_status
     FROM users u JOIN applicant_profiles ap ON ap.user_id = u.id
     WHERE ap.school_id = ?
     ORDER BY u.name`,
    schoolId
  )
  res.json(students)
})

router.get('/students/:id', requireAuth, requireRole('school'), async (req, res) => {
  if (!(await canTrackStudents(req.user.id)))
    return res.status(403).json({ error: 'Verify your school account before tracking students. Upload your documents in your profile.' })
  const schoolId = await coordinatorSchool(req.user.id)
  if (!schoolId) return res.status(400).json({ error: 'Your school account is not linked to any school yet' })

  const student = await get(
    `SELECT u.id, u.name, u.email, u.created_at, ap.course, ap.year_level, ap.phone, ap.search_city, ap.student_id,
            e.id AS enrollment_id, e.status AS enrollment_status,
            sc.name AS enrolled_course, sr.name AS enrolled_room
     FROM users u
     JOIN applicant_profiles ap ON ap.user_id = u.id
     LEFT JOIN enrollments e ON e.user_id = u.id AND e.school_id = ?
     LEFT JOIN school_courses sc ON sc.id = e.course_id
     LEFT JOIN school_rooms sr ON sr.id = e.room_id
     WHERE u.id = ? AND ap.school_id = ?`,
    schoolId,
    req.params.id,
    schoolId
  )
  if (!student) return res.status(404).json({ error: 'Student not found in your school' })

  const applications = await all(
    `SELECT a.id, a.status, a.cover_message, a.created_at, a.updated_at,
            p.title AS posting_title, p.city, p.address, p.course_tags, c.company_name, c.industry
     FROM applications a
     JOIN postings p ON p.id = a.posting_id
     JOIN company_profiles c ON c.user_id = p.company_id
     WHERE a.applicant_id = ?
     ORDER BY a.updated_at DESC`,
    student.id
  )

  for (const app of applications) {
    app.status_history = await all('SELECT * FROM status_history WHERE application_id = ? ORDER BY id ASC', app.id)
  }

  res.json({ ...student, applications })
})

async function guardSchool(req, res) {
  if (!(await canTrackStudents(req.user.id))) {
    res.status(403).json({ error: 'Verify your school account before tracking students. Upload your documents in your profile.' })
    return null
  }
  const schoolId = await coordinatorSchool(req.user.id)
  if (!schoolId) {
    res.status(400).json({ error: 'Your school account is not linked to any school yet' })
    return null
  }
  return schoolId
}

async function getCourseRoom(schoolId, courseId, roomId) {
  const course = courseId ? await get('SELECT * FROM school_courses WHERE id = ? AND school_id = ?', Number(courseId), schoolId) : null
  if (courseId && !course) return { error: 'Course not found in your school' }
  if (roomId) {
    const room = await get('SELECT * FROM school_rooms WHERE id = ? AND school_id = ? AND course_id = ?', Number(roomId), schoolId, Number(courseId))
    if (!room) return { error: 'Room not found in that course' }
  }
  return { course, room: roomId ? await get('SELECT * FROM school_rooms WHERE id = ?', Number(roomId)) : null }
}

router.get('/courses', requireAuth, requireRole('school'), async (req, res, next) => {
  try {
    const schoolId = await guardSchool(req, res)
    if (!schoolId) return
    const courses = await all('SELECT * FROM school_courses WHERE school_id = ? ORDER BY lower(name)', schoolId)
    for (const c of courses) {
      c.rooms = await all('SELECT * FROM school_rooms WHERE course_id = ? ORDER BY lower(name)', c.id)
    }
    res.json(courses)
  } catch (err) { next(err) }
})

router.post('/courses', requireAuth, requireRole('school'), async (req, res, next) => {
  try {
    const schoolId = await guardSchool(req, res)
    if (!schoolId) return
    const name = String(req.body?.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Course name is required' })
    const dup = await get('SELECT id FROM school_courses WHERE school_id = ? AND lower(name) = lower(?)', schoolId, name.toLowerCase())
    if (dup) return res.status(400).json({ error: 'You already have that course' })
    const id = await run('INSERT INTO school_courses (school_id, name) VALUES (?, ?)', schoolId, name)
    res.status(201).json({ id, name })
  } catch (err) { next(err) }
})

router.delete('/courses/:id', requireAuth, requireRole('school'), async (req, res, next) => {
  try {
    const schoolId = await guardSchool(req, res)
    if (!schoolId) return
    const course = await get('SELECT * FROM school_courses WHERE id = ? AND school_id = ?', Number(req.params.id), schoolId)
    if (!course) return res.status(404).json({ error: 'Course not found' })
    const used = await get('SELECT id FROM enrollments WHERE course_id = ? LIMIT 1', course.id)
    if (used) return res.status(400).json({ error: 'Delete students from this course first before removing it' })
    await run('DELETE FROM school_rooms WHERE course_id = ?', course.id)
    await run('DELETE FROM school_courses WHERE id = ?', course.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.post('/courses/:courseId/rooms', requireAuth, requireRole('school'), async (req, res, next) => {
  try {
    const schoolId = await guardSchool(req, res)
    if (!schoolId) return
    const course = await get('SELECT * FROM school_courses WHERE id = ? AND school_id = ?', Number(req.params.courseId), schoolId)
    if (!course) return res.status(404).json({ error: 'Course not found' })
    const name = String(req.body?.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Room name is required' })
    const dup = await get('SELECT id FROM school_rooms WHERE school_id = ? AND course_id = ? AND lower(name) = lower(?)', schoolId, course.id, name.toLowerCase())
    if (dup) return res.status(400).json({ error: 'That room already exists in this course' })
    const id = await run('INSERT INTO school_rooms (school_id, course_id, name) VALUES (?, ?, ?)', schoolId, course.id, name)
    res.status(201).json({ id, name })
  } catch (err) { next(err) }
})

router.delete('/rooms/:id', requireAuth, requireRole('school'), async (req, res, next) => {
  try {
    const schoolId = await guardSchool(req, res)
    if (!schoolId) return
    const room = await get('SELECT * FROM school_rooms WHERE id = ? AND school_id = ?', Number(req.params.id), schoolId)
    if (!room) return res.status(404).json({ error: 'Room not found' })
    const used = await get('SELECT id FROM enrollments WHERE room_id = ? LIMIT 1', room.id)
    if (used) return res.status(400).json({ error: 'Move students out of this room before removing it' })
    await run('DELETE FROM school_rooms WHERE id = ?', room.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.get('/enrollments', requireAuth, requireRole('school'), async (req, res, next) => {
  try {
    const schoolId = await guardSchool(req, res)
    if (!schoolId) return

    const rows = await all(
      `SELECT e.id AS enrollment_id, e.student_id, e.status, e.created_at AS added_at,
              e.user_id, e.course_id, e.room_id,
              u.name, u.email, ap.student_id AS profile_student_id, ap.school_id,
              (SELECT COUNT(*) FROM applications a WHERE a.applicant_id = e.user_id) AS applications_count,
              (SELECT a.status FROM applications a WHERE a.applicant_id = e.user_id ORDER BY a.updated_at DESC LIMIT 1) AS latest_status
       FROM enrollments e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = e.user_id
       WHERE e.school_id = ?
       ORDER BY e.id DESC`,
      schoolId
    )

    const enrolledUserIds = rows.filter((r) => r.user_id).map((r) => r.user_id)
    const placeholders = enrolledUserIds.length ? enrolledUserIds.map((id) => Number(id)).join(',') : '0'
    const legacy = await all(
      `SELECT u.id AS user_id, ap.school_id, u.name, u.email, ap.student_id AS profile_student_id, ap.course, ap.year_level,
              (SELECT COUNT(*) FROM applications a WHERE a.applicant_id = u.id) AS applications_count,
              (SELECT a.status FROM applications a WHERE a.applicant_id = u.id ORDER BY a.updated_at DESC LIMIT 1) AS latest_status
       FROM users u JOIN applicant_profiles ap ON ap.user_id = u.id
       WHERE ap.school_id = ? AND u.role = 'applicant' AND u.id NOT IN (${placeholders})
       ORDER BY u.name`,
      schoolId
    ).catch(() => [])

    const courses = await all('SELECT * FROM school_courses WHERE school_id = ? ORDER BY lower(name)', schoolId)
    for (const c of courses) {
      c.rooms = await all('SELECT * FROM school_rooms WHERE course_id = ? ORDER BY lower(name)', c.id)
      c.active_count = 0
      c.invited_count = 0
      for (const r of c.rooms) {
        r.students = rows.filter((x) => x.course_id === c.id && x.room_id === r.id && x.status === 'active')
        r.invited = rows.filter((x) => x.course_id === c.id && x.room_id === r.id && x.status === 'invited')
        c.active_count += r.students.length
        c.invited_count += r.invited.length
      }
    }

    const unassigned = rows.filter((x) => !x.course_id && !x.room_id)
    const school = await get('SELECT name FROM schools WHERE id = ?', schoolId)
    res.json({
      school_id: schoolId,
      school_name: school?.name || '',
      total_active: rows.filter((x) => x.status === 'active').length + legacy.length,
      total_invited: rows.filter((x) => x.status === 'invited').length,
      courses,
      unassigned,
      legacy
    })
  } catch (err) { next(err) }
})

router.post('/enrollments', requireAuth, requireRole('school'), async (req, res, next) => {
  try {
    const schoolId = await guardSchool(req, res)
    if (!schoolId) return
    const studentId = String(req.body?.studentId || '').trim()
    if (!studentId) return res.status(400).json({ error: 'Student ID is required' })
    const courseId = Number(req.body?.courseId)
    const roomId = Number(req.body?.roomId)
    if (!courseId || !roomId) return res.status(400).json({ error: 'Pick a course and a room for this student' })
    const cr = await getCourseRoom(schoolId, courseId, roomId)
    if (cr.error) return res.status(400).json({ error: cr.error })

    const existing = await get(
      `SELECT e.*, s.name AS school_name FROM enrollments e JOIN schools s ON s.id = e.school_id
       WHERE lower(e.student_id) = lower(?) LIMIT 1`,
      studentId
    )
    if (existing) {
      if (existing.school_id === schoolId) {
        return res.status(400).json({ error: 'That Student ID is already listed in your school — update or remove the existing entry instead' })
      }
      return res.status(400).json({ error: `That Student ID already belongs to ${existing.school_name}. A student can only be tracked by one school.` })
    }

    const matched = await get(
      `SELECT u.id, u.name, ap.school_id FROM users u JOIN applicant_profiles ap ON ap.user_id = u.id
       WHERE u.role = 'applicant' AND lower(ap.student_id) = lower(?) LIMIT 1`,
      studentId
    )
    if (matched && matched.school_id && matched.school_id !== schoolId) {
      const other = await get('SELECT name FROM schools WHERE id = ?', matched.school_id)
      return res.status(400).json({ error: `That student already belongs to ${other?.name || 'another school'}. A student can only be tracked by one school.` })
    }

    const nameHint = String(req.body?.name || matched?.name || '').trim()
    const id = await run(
      `INSERT INTO enrollments (school_id, course_id, room_id, user_id, student_id, name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      schoolId,
      courseId,
      roomId,
      matched?.user_id ?? null,
      studentId,
      nameHint,
      matched ? 'active' : 'invited'
    )
    if (matched) {
      if (!matched.school_id) await run('UPDATE applicant_profiles SET school_id = ? WHERE user_id = ?', schoolId, matched.user_id)
    }
    res.status(201).json({
      enrollment_id: id,
      placed: !!matched,
      message: matched ? `${matched.name} was found by that Student ID and placed in this course/room.` : 'Added — waiting for the student to register with this Student ID.'
    })
  } catch (err) { next(err) }
})

router.post('/enrollments/place', requireAuth, requireRole('school'), async (req, res, next) => {
  try {
    const schoolId = await guardSchool(req, res)
    if (!schoolId) return
    const courseId = Number(req.body?.courseId)
    const roomId = Number(req.body?.roomId)
    if (!courseId || !roomId) return res.status(400).json({ error: 'Pick a course and a room' })
    const cr = await getCourseRoom(schoolId, courseId, roomId)
    if (cr.error) return res.status(400).json({ error: cr.error })

    const enrollmentId = Number(req.body?.enrollmentId)
    const userId = Number(req.body?.userId)
    if (enrollmentId) {
      const e = await get('SELECT * FROM enrollments WHERE id = ? AND school_id = ?', enrollmentId, schoolId)
      if (!e) return res.status(404).json({ error: 'Enrollment not found' })
      await run('UPDATE enrollments SET course_id = ?, room_id = ? WHERE id = ?', courseId, roomId, e.id)
      return res.json({ ok: true, message: 'Student moved into the selected course/room.' })
    }
    if (userId) {
      const ap = await get('SELECT * FROM applicant_profiles WHERE user_id = ?', userId)
      if (!ap || ap.school_id !== schoolId) return res.status(400).json({ error: 'Student not found in your school' })
      const dup = await get('SELECT id FROM enrollments WHERE user_id = ? AND school_id <> ? LIMIT 1', userId, schoolId)
      if (dup) return res.status(400).json({ error: 'Student is already tracked by another school' })
      const existing = await get('SELECT id FROM enrollments WHERE user_id = ? AND school_id = ?', userId, schoolId)
      if (existing) {
        await run('UPDATE enrollments SET course_id = ?, room_id = ? WHERE id = ?', courseId, roomId, existing.id)
        return res.json({ ok: true, message: 'Student placed in the selected course/room.' })
      }
      const sid = String(ap.student_id || `SID-${userId}`).trim()
      const dupSid = await get('SELECT id FROM enrollments WHERE lower(student_id) = lower(?) LIMIT 1', sid)
      if (dupSid) return res.status(400).json({ error: 'Student ID is already tracked by another school' })
      const appRow = await get('SELECT name FROM users WHERE id = ?', userId)
      await run(
        `INSERT INTO enrollments (school_id, course_id, room_id, user_id, student_id, name, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        schoolId, courseId, roomId, userId, sid, appRow?.name || ''
      )
      return res.status(201).json({ ok: true, message: 'Student placed in the selected course/room.' })
    }
    return res.status(400).json({ error: 'Missing enrollment or student' })
  } catch (err) { next(err) }
})

router.delete('/enrollments/:id', requireAuth, requireRole('school'), async (req, res, next) => {
  try {
    const schoolId = await guardSchool(req, res)
    if (!schoolId) return
    const result = await run('DELETE FROM enrollments WHERE id = ? AND school_id = ?', Number(req.params.id), schoolId)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.get('/my-placement', requireAuth, requireRole('applicant'), async (req, res, next) => {
  try {
    const ap = await get('SELECT school_id, student_id FROM applicant_profiles WHERE user_id = ?', req.user.id)
    const school = ap?.school_id ? await get('SELECT id, name, logo FROM schools WHERE id = ?', ap.school_id) : null
    const enrollment = ap
      ? await get(
          `SELECT e.id, e.status, e.student_id, e.created_at,
                  sc.name AS course_name, sr.name AS room_name,
                  s.id AS school_id, s.name AS school_name, s.logo
           FROM enrollments e
           LEFT JOIN school_courses sc ON sc.id = e.course_id
           LEFT JOIN school_rooms sr ON sr.id = e.room_id
           JOIN schools s ON s.id = e.school_id
           WHERE e.user_id = ? AND e.school_id = ?`,
          req.user.id,
          ap.school_id
        )
      : null
    res.json({
      placed: !!enrollment,
      school_id: school?.id || null,
      school_name: school?.name || null,
      student_id: ap?.student_id || '',
      enrollment
    })
  } catch (err) { next(err) }
})

export default router
