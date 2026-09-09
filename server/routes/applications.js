import { Router } from 'express'
import { all, get, run, nowTs, APPLICATION_STATUSES, STATUS_META } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { attachResumeToApplication } from './resume.js'

const router = Router()

router.use(requireAuth)

function serializeApplication(row) {
  return {
    ...row,
    status_meta: STATUS_META[row.status] || { label: row.status, color: '#8A8FA3' }
  }
}

router.post('/', requireRole('applicant'), async (req, res, next) => {
  try {
    const { posting_id, cover_message } = req.body
    const posting = await get('SELECT * FROM postings WHERE id = ?', posting_id)
    if (!posting) return res.status(404).json({ error: 'Posting not found' })
    if (posting.status !== 'open') return res.status(400).json({ error: 'This posting is no longer accepting applications' })

    const existing = await get(
      `SELECT * FROM applications WHERE applicant_id = ? AND posting_id = ? AND status NOT IN ('rejected','withdrawn')`,
      req.user.id,
      posting_id
    )
    if (existing) return res.status(409).json({ error: 'You already have an active application for this posting' })

    const id = await run(
      'INSERT INTO applications (posting_id, applicant_id, cover_message, status) VALUES (?, ?, ?, ?)',
      posting_id,
      req.user.id,
      String(cover_message || '').trim(),
      'submitted'
    )
    await run('INSERT INTO status_history (application_id, status, note) VALUES (?, ?, ?)', id, 'submitted', 'Your application was submitted')

    let resumeAttached = false
    let resumeMissing = false
    const attach = await attachResumeToApplication({ applicationId: id, applicantId: req.user.id, app: req.app })
    if (attach.attached) resumeAttached = true
    else if (attach.reason === 'empty') resumeMissing = true

    const row = await get(
      `SELECT a.*, p.title AS posting_title, c.company_name FROM applications a
       JOIN postings p ON p.id = a.posting_id JOIN company_profiles c ON c.user_id = p.company_id
       WHERE a.id = ?`,
      id
    )
    res.status(201).json({ ...serializeApplication(row), resume_attached: resumeAttached, resume_missing: resumeMissing })
  } catch (err) {
    next(err)
  }
})

router.get('/my', requireRole('applicant'), async (req, res) => {
  const rows = await all(
    `SELECT a.*, p.title AS posting_title, p.city, p.address, p.course_tags, c.company_name,
            (SELECT COUNT(*) FROM messages m
             WHERE m.application_id = a.id AND m.sender_id != ? AND m.is_read = 0) AS unread_count
     FROM applications a
     JOIN postings p ON p.id = a.posting_id
     JOIN company_profiles c ON c.user_id = p.company_id
     WHERE a.applicant_id = ?
     ORDER BY a.updated_at DESC`,
    req.user.id,
    req.user.id
  )
  res.json(rows.map(serializeApplication))
})

router.get('/company', requireRole('company'), async (req, res) => {
  const postingId = req.query.posting_id
  let rows
  if (postingId) {
    rows = await all(
      `SELECT a.*, p.title AS posting_title, p.city, u.name AS applicant_name, ap.course, ap.year_level, ap.phone, s.name AS school_name
       FROM applications a
       JOIN postings p ON p.id = a.posting_id
       JOIN users u ON u.id = a.applicant_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
       LEFT JOIN schools s ON s.id = ap.school_id
       WHERE p.company_id = ? AND a.posting_id = ?
       ORDER BY a.updated_at DESC`,
      req.user.id,
      postingId
    )
  } else {
    rows = await all(
      `SELECT a.*, p.title AS posting_title, p.city, u.name AS applicant_name, ap.course, ap.year_level, ap.phone, s.name AS school_name
       FROM applications a
       JOIN postings p ON p.id = a.posting_id
       JOIN users u ON u.id = a.applicant_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
       LEFT JOIN schools s ON s.id = ap.school_id
       WHERE p.company_id = ?
       ORDER BY a.updated_at DESC`,
      req.user.id
    )
  }
  res.json(rows.map(serializeApplication))
})

async function loadFullApplication(id) {
  return get(
    `SELECT a.*, p.title AS posting_title, p.company_id AS company_id, p.status AS posting_status, p.description AS posting_description,
            p.requirements AS posting_requirements, p.course_tags, p.city, p.address, p.slots,
            u.name AS applicant_name, u.email AS applicant_email,
            ap.course, ap.year_level, ap.phone, ap.school_id, s.name AS school_name,
            c.company_name, c.industry, c.description AS company_description, c.address AS company_address,
            c.lat AS company_lat, c.lng AS company_lng,
            (SELECT m.file_path FROM messages m WHERE m.application_id = a.id AND m.file_mime = 'application/pdf' AND m.file_name LIKE 'Resume_%' ORDER BY m.id DESC LIMIT 1) AS resume_path,
            (SELECT m.file_name FROM messages m WHERE m.application_id = a.id AND m.file_mime = 'application/pdf' AND m.file_name LIKE 'Resume_%' ORDER BY m.id DESC LIMIT 1) AS resume_name
     FROM applications a
     JOIN postings p ON p.id = a.posting_id
     JOIN users u ON u.id = a.applicant_id
     LEFT JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
     LEFT JOIN schools s ON s.id = ap.school_id
     JOIN company_profiles c ON c.user_id = p.company_id
     WHERE a.id = ?`,
    id
  )
}

function canAccess(req, row) {
  if (!row) return false
  if (req.user.role === 'company') return row.company_id === req.user.id
  if (req.user.role === 'applicant') return row.applicant_id === req.user.id
  return false
}

router.get('/:id', async (req, res) => {
  const row = await loadFullApplication(req.params.id)
  if (!row) return res.status(404).json({ error: 'Application not found' })
  if (!canAccess(req, row)) return res.status(403).json({ error: 'Not your application' })

  const history = await all('SELECT * FROM status_history WHERE application_id = ? ORDER BY id ASC', row.id)
  row.status_history = history
  res.json(serializeApplication(row))
})

router.put('/:id/status', requireRole('company'), async (req, res) => {
  const row = await loadFullApplication(req.params.id)
  if (!row) return res.status(404).json({ error: 'Application not found' })
  if (!canAccess(req, row)) return res.status(403).json({ error: 'Not your application' })

  const status = req.body?.status
  if (!APPLICATION_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
  if (status === 'withdrawn') return res.status(400).json({ error: 'Only the applicant can withdraw' })
  const note = String(req.body?.note || '').trim()
  if (status === 'rejected' && !note) return res.status(400).json({ error: 'Please provide a reason when declining an application' })

  await run('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?', status, nowTs(), row.id)
  await run('INSERT INTO status_history (application_id, status, note) VALUES (?, ?, ?)', row.id, status, note)

  const updated = await loadFullApplication(row.id)
  updated.status_history = await all('SELECT * FROM status_history WHERE application_id = ? ORDER BY id ASC', row.id)
  res.json(serializeApplication(updated))
})

router.post('/:id/withdraw', requireRole('applicant'), async (req, res) => {
  const row = await loadFullApplication(req.params.id)
  if (!row) return res.status(404).json({ error: 'Application not found' })
  if (row.applicant_id !== req.user.id) return res.status(403).json({ error: 'Not your application' })
  if (row.status === 'withdrawn') return res.status(400).json({ error: 'Already withdrawn' })
  if (['accepted'].includes(row.status)) return res.status(400).json({ error: 'Cannot withdraw after acceptance' })

  await run('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?', 'withdrawn', nowTs(), row.id)
  await run('INSERT INTO status_history (application_id, status, note) VALUES (?, ?, ?)', row.id, 'withdrawn', 'Application withdrawn by applicant')

  const updated = await loadFullApplication(row.id)
  updated.status_history = await all('SELECT * FROM status_history WHERE application_id = ? ORDER BY id ASC', row.id)
  res.json(serializeApplication(updated))
})

export default router
