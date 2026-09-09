import { Router } from 'express'
import { all, get, run, nowTs } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

const router = Router()

const DOC_TYPES = new Set(['valid_id', 'registration', 'permit', 'credentials'])

router.use(requireAuth)

export async function isVerified(userId) {
  const row = await get(
    `SELECT u.is_verified,
            (SELECT COUNT(*) FROM verifications v WHERE v.user_id = u.id AND v.status = 'approved') AS approved_docs
     FROM users u WHERE u.id = ?`,
    userId
  )
  return !!(row && (row.is_verified || row.approved_docs))
}

router.get('/status', async (req, res) => {
  const row = await get('SELECT is_verified FROM users WHERE id = ?', req.user.id)
  const rows = await all('SELECT id, status FROM verifications WHERE user_id = ?', req.user.id)
  const docsVerified = rows.some((v) => v.status === 'approved')
  res.json({
    verified: !!(row?.is_verified || docsVerified),
    pendingCount: rows.filter((v) => v.status === 'pending').length
  })
})

router.get('/mine', requireRole('company', 'school'), async (req, res) => {
  const rows = await all('SELECT * FROM verifications WHERE user_id = ? ORDER BY id DESC', req.user.id)
  res.json(rows)
})

router.post(
  '/',
  requireRole('company', 'school'),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Please select a file to upload' })
    const documentType = String(req.body?.document_type || 'credentials').trim()
    if (!DOC_TYPES.has(documentType)) return res.status(400).json({ error: 'Invalid document type' })
    const label = String(req.body?.label || '').trim().slice(0, 255)

    const id = await run(
      `INSERT INTO verifications (user_id, kind, document_type, label, file_name, file_path, file_mime, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user.id,
      req.user.role,
      documentType,
      label,
      req.file.originalname,
      `/uploads/${req.file.filename}`,
      req.file.mimetype,
      req.file.size
    )
    const doc = await get('SELECT * FROM verifications WHERE id = ?', id)
    res.status(201).json(doc)
  },
  (err, req, res, next) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  }
)

router.delete('/:id', requireRole('company', 'school'), async (req, res) => {
  const doc = await get('SELECT * FROM verifications WHERE id = ?', req.params.id)
  if (!doc || doc.user_id !== req.user.id) return res.status(404).json({ error: 'Document not found' })
  if (doc.status === 'approved')
    return res.status(400).json({ error: 'Approved documents cannot be removed' })
  await run('DELETE FROM verifications WHERE id = ?', req.params.id)
  res.json({ ok: true })
})

router.get('/all', requireRole('admin'), async (req, res) => {
  const rows = await all(
    `SELECT v.*, u.email, u.role AS user_role,
            COALESCE(c.company_name, sch.name, '') AS org_name
     FROM verifications v
     JOIN users u ON u.id = v.user_id
     LEFT JOIN company_profiles c ON c.user_id = v.user_id
     LEFT JOIN school_coordinators sc ON sc.user_id = v.user_id
     LEFT JOIN schools sch ON sch.id = sc.school_id
     ORDER BY (v.status = 'pending') DESC, v.id DESC`
  )
  res.json(rows)
})

router.patch('/all/:id', requireRole('admin'), async (req, res) => {
  const status = String(req.body?.status || '')
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ error: 'Invalid status' })
  const note = String(req.body?.note || '').trim().slice(0, 500)
  const doc = await get('SELECT * FROM verifications WHERE id = ?', req.params.id)
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  await run(
    'UPDATE verifications SET status = ?, note = ?, reviewed_at = ? WHERE id = ?',
    status,
    note,
    nowTs(),
    req.params.id
  )
  res.json({ ok: true })
})

router.delete('/all/:id', requireRole('admin'), async (req, res) => {
  const doc = await get('SELECT * FROM verifications WHERE id = ?', req.params.id)
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  await run('DELETE FROM verifications WHERE id = ?', req.params.id)
  res.json({ ok: true })
})

export default router