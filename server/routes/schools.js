import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/', (req, res) => {
  const schools = all('SELECT id, name FROM schools ORDER BY lower(name)')
  res.json(schools)
})

router.post('/', (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'School name is required' })
  let school = get('SELECT * FROM schools WHERE lower(name) = lower(?)', name)
  if (!school) {
    const id = run('INSERT INTO schools (name) VALUES (?)', name)
    school = { id, name }
  }
  res.status(201).json(school)
})

function coordinatorSchool(userId) {
  const coord = get('SELECT * FROM school_coordinators WHERE user_id = ?', userId)
  return coord?.school_id ?? null
}

router.get('/stats', requireAuth, requireRole('school'), (req, res) => {
  const schoolId = coordinatorSchool(req.user.id)
  if (!schoolId) return res.status(400).json({ error: 'Your school account is not linked to any school yet' })

  const students = all(
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

router.get('/students', requireAuth, requireRole('school'), (req, res) => {
  const schoolId = coordinatorSchool(req.user.id)
  if (!schoolId) return res.status(400).json({ error: 'Your school account is not linked to any school yet' })

  const students = all(
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

router.get('/students/:id', requireAuth, requireRole('school'), (req, res) => {
  const schoolId = coordinatorSchool(req.user.id)
  if (!schoolId) return res.status(400).json({ error: 'Your school account is not linked to any school yet' })

  const student = get(
    `SELECT u.id, u.name, u.email, u.created_at, ap.course, ap.year_level, ap.phone, ap.search_city
     FROM users u JOIN applicant_profiles ap ON ap.user_id = u.id
     WHERE u.id = ? AND ap.school_id = ?`,
    req.params.id,
    schoolId
  )
  if (!student) return res.status(404).json({ error: 'Student not found in your school' })

  const applications = all(
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
    app.status_history = all('SELECT * FROM status_history WHERE application_id = ? ORDER BY id ASC', app.id)
  }

  res.json({ ...student, applications })
})

export default router