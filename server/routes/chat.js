import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { upload, mimeCategory } from '../middleware/upload.js'

const router = Router()

router.use(requireAuth)

async function coordinatorSchool(userId) {
  const coord = await get('SELECT school_id FROM school_coordinators WHERE user_id = ?', userId)
  return coord?.school_id ?? null
}

function serializeMessage(m) {
  return { ...m, category: mimeCategory(m.file_mime) }
}

function schoolRoom(schoolId, studentId) {
  return `schat-${schoolId}-${studentId}`
}

function emitToSchool(io, schoolId, studentId, message) {
  if (io) io.to(schoolRoom(schoolId, studentId)).emit('message:new', serializeMessage(message))
}

async function studentWithSchool(studentId) {
  return get(
    `SELECT u.id, u.name, u.email, ap.school_id FROM users u JOIN applicant_profiles ap ON ap.user_id = u.id WHERE u.id = ?`,
    Number(studentId)
  )
}

async function canAccessSchoolChat(student, req) {
  if (!student || !student.school_id) return false
  if (req.user.role === 'applicant' && req.user.id === student.id) return true
  if (req.user.role === 'school') return (await coordinatorSchool(req.user.id)) === student.school_id
  return false
}

router.get('/school-threads', async (req, res, next) => {
  try {
    if (req.user.role !== 'school') return res.status(403).json({ error: 'For school coordinators only' })
    const coord = await coordinatorSchool(req.user.id)
    if (!coord) return res.status(403).json({ error: 'No school linked' })

    const rows = await all(
      `SELECT m.student_id, u.name, u.email, ap.student_id AS profile_student_id,
              SUM(CASE WHEN m.sender_id != ? AND m.is_read = 0 THEN 1 ELSE 0 END) AS unread
       FROM school_messages m
       JOIN users u ON u.id = m.student_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = m.student_id
       WHERE m.school_id = ?
       GROUP BY m.student_id, u.name, u.email, ap.student_id
       ORDER BY MAX(m.id) DESC`,
      req.user.id,
      coord
    )

    const threads = []
    for (const r of rows) {
      const last = await get(
        'SELECT content, file_name, sender_role, created_at FROM school_messages WHERE school_id = ? AND student_id = ? ORDER BY id DESC LIMIT 1',
        coord,
        r.student_id
      )
      threads.push({
        studentId: r.student_id,
        name: r.name,
        email: r.email,
        studentIdNumber: r.profile_student_id,
        unread: Number(r.unread || 0),
        last: last
          ? { content: last.content, file_name: last.file_name, sender_role: last.sender_role, created_at: last.created_at }
          : null
      })
    }

    res.json({ threads })
  } catch (err) { next(err) }
})

router.get('/unread', async (req, res, next) => {
  try {
    let total = 0
    if (req.user.role === 'school') {
      const coord = await coordinatorSchool(req.user.id)
      if (coord) {
        const row = await get(
          'SELECT COUNT(*) AS c FROM school_messages WHERE school_id = ? AND sender_id != ? AND is_read = 0',
          coord,
          req.user.id
        )
        total = Number(row?.c || 0)
      }
    } else if (req.user.role === 'applicant') {
      const ap = await get('SELECT school_id FROM applicant_profiles WHERE user_id = ?', req.user.id)
      if (ap?.school_id) {
        const row = await get(
          'SELECT COUNT(*) AS c FROM school_messages WHERE school_id = ? AND student_id = ? AND sender_id != ? AND is_read = 0',
          ap.school_id,
          req.user.id,
          req.user.id
        )
        total += Number(row?.c || 0)
      }
      const appRow = await get(
        `SELECT COUNT(*) AS c FROM messages m
         JOIN applications a ON a.id = m.application_id
         WHERE a.applicant_id = ? AND m.sender_id != ? AND m.is_read = 0`,
        req.user.id,
        req.user.id
      )
      total += Number(appRow?.c || 0)
    } else if (req.user.role === 'company') {
      const appRow = await get(
        `SELECT COUNT(*) AS c FROM messages m
         JOIN applications a ON a.id = m.application_id
         JOIN postings p ON p.id = a.posting_id
         WHERE p.company_id = ? AND m.sender_id != ? AND m.is_read = 0`,
        req.user.id,
        req.user.id
      )
      total += Number(appRow?.c || 0)
    }
    res.json({ total })
  } catch (err) { next(err) }
})

router.get('/school/:studentId', async (req, res, next) => {
  try {
    const student = await studentWithSchool(req.params.studentId)
    if (!(await canAccessSchoolChat(student, req))) {
      return res.status(student ? 403 : 404).json({ error: student ? 'No access to this conversation' : 'Student not found' })
    }
    const school = await get('SELECT id, name, logo FROM schools WHERE id = ?', student.school_id)
    const messages = await all(
      'SELECT * FROM school_messages WHERE school_id = ? AND student_id = ? ORDER BY id ASC',
      student.school_id,
      student.id
    )
    await run(
      'UPDATE school_messages SET is_read = 1 WHERE school_id = ? AND student_id = ? AND sender_id != ?',
      student.school_id,
      student.id,
      req.user.id
    )
    res.json({
      school: school || { id: student.school_id },
      student: { id: student.id, name: student.name, email: student.email },
      messages: messages.map(serializeMessage)
    })
  } catch (err) { next(err) }
})

router.post('/school/:studentId', async (req, res, next) => {
  try {
    const student = await studentWithSchool(req.params.studentId)
    if (!(await canAccessSchoolChat(student, req))) {
      return res.status(student ? 403 : 404).json({ error: student ? 'No access to this conversation' : 'Student not found' })
    }
    const content = String(req.body?.content || '').trim()
    if (!content) return res.status(400).json({ error: 'Message is empty' })

    const id = await run(
      'INSERT INTO school_messages (school_id, student_id, sender_id, sender_role, content) VALUES (?, ?, ?, ?, ?)',
      student.school_id,
      student.id,
      req.user.id,
      req.user.role,
      content
    )
    const message = await get('SELECT * FROM school_messages WHERE id = ?', id)
    emitToSchool(req.app.get('io'), student.school_id, student.id, message)
    res.status(201).json(serializeMessage(message))
  } catch (err) { next(err) }
})

router.post(
  '/school/:studentId/upload',
  upload.single('file'),
  async (req, res) => {
    try {
      const student = await studentWithSchool(req.params.studentId)
      if (!(await canAccessSchoolChat(student, req))) {
        return res.status(student ? 403 : 404).json({ error: student ? 'No access to this conversation' : 'Student not found' })
      }
      if (!req.file) return res.status(400).json({ error: 'No file received' })
      const content = String(req.body?.content || '').trim()

      const id = await run(
        `INSERT INTO school_messages (school_id, student_id, sender_id, sender_role, content, file_name, file_path, file_mime, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        student.school_id,
        student.id,
        req.user.id,
        req.user.role,
        content,
        req.file.originalname,
        `/uploads/${req.file.filename}`,
        req.file.mimetype,
        req.file.size
      )
      const message = await get('SELECT * FROM school_messages WHERE id = ?', id)
      emitToSchool(req.app.get('io'), student.school_id, student.id, message)
      res.status(201).json(serializeMessage(message))
    } catch (err) {
      if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File must be 10 MB or smaller' })
      if (err?.message) return res.status(400).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Something went wrong' })
    }
  }
)

router.post('/school/:studentId/seen', async (req, res, next) => {
  try {
    const student = await studentWithSchool(req.params.studentId)
    if (!(await canAccessSchoolChat(student, req))) {
      return res.status(student ? 403 : 404).json({ error: student ? 'No access to this conversation' : 'Student not found' })
    }
    await run(
      'UPDATE school_messages SET is_read = 1 WHERE school_id = ? AND student_id = ? AND sender_id != ?',
      student.school_id,
      student.id,
      req.user.id
    )
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.get('/my-threads', async (req, res, next) => {
  try {
    if (req.user.role !== 'applicant') return res.status(403).json({ error: 'For applicants only' })
    const ap = await get('SELECT school_id FROM applicant_profiles WHERE user_id = ?', req.user.id)
    const threads = []

    if (ap?.school_id) {
      const school = await get('SELECT id, name, logo FROM schools WHERE id = ?', ap.school_id)
      if (school) {
        const last = await get(
          `SELECT * FROM school_messages WHERE school_id = ? AND student_id = ? ORDER BY id DESC LIMIT 1`,
          school.id,
          req.user.id
        )
        const unread = await get(
          `SELECT COUNT(*) AS c FROM school_messages WHERE school_id = ? AND student_id = ? AND sender_id != ? AND is_read = 0`,
          school.id,
          req.user.id,
          req.user.id
        )
        threads.push({
          key: `school-${school.id}`,
          type: 'school',
          name: school.name,
          logo: school.logo,
          last: last ? { content: last.content, file_name: last.file_name, created_at: last.created_at, sender_role: last.sender_role } : null,
          unread: Number(unread?.c || 0)
        })
      }
    }

    const accepted = await all(
      `SELECT a.id, a.status, p.title AS posting_title, c.company_name, c.logo,
              (SELECT m.content FROM messages m WHERE m.application_id = a.id ORDER BY m.id DESC LIMIT 1) AS last_content,
              (SELECT m.file_name FROM messages m WHERE m.application_id = a.id ORDER BY m.id DESC LIMIT 1) AS last_file,
              (SELECT m.created_at FROM messages m WHERE m.application_id = a.id ORDER BY m.id DESC LIMIT 1) AS last_at,
              (SELECT m.sender_role FROM messages m WHERE m.application_id = a.id ORDER BY m.id DESC LIMIT 1) AS last_sender,
              (SELECT COUNT(*) FROM messages m WHERE m.application_id = a.id AND m.sender_id != a.applicant_id AND m.is_read = 0) AS unread
       FROM applications a
       JOIN postings p ON p.id = a.posting_id
       JOIN company_profiles c ON c.user_id = p.company_id
       WHERE a.applicant_id = ? AND a.status = 'accepted'
       ORDER BY a.updated_at DESC`,
      req.user.id
    )
    for (const a of accepted) {
      threads.push({
        key: `app-${a.id}`,
        type: 'application',
        applicationId: a.id,
        name: a.company_name,
        logo: a.logo,
        subtitle: a.posting_title,
        last: a.last_content || a.last_file
          ? { content: a.last_content, file_name: a.last_file, created_at: a.last_at, sender_role: a.last_sender }
          : null,
        unread: Number(a.unread || 0)
      })
    }

    res.json({ threads })
  } catch (err) { next(err) }
})

export default router