import { Router } from 'express'
import { get, run, all, transaction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { uploadFor } from '../middleware/upload.js'
import { adminSockets } from '../presence.js'
import { sendAccountRequestEmail } from '../mailer.js'

const router = Router()

const KINDS = ['company', 'school']
const STATUSES = ['pending', 'contacted', 'completed', 'approved', 'rejected']
const requestUpload = uploadFor(20 * 1024 * 1024)

router.get('/', (req, res) => {
  res.json({ online: adminSockets.size > 0, adminCount: adminSockets.size })
})

router.post(
  '/requests',
  requestUpload.array('file', 2),
  async (req, res, next) => {
    try {
      const { kind } = req.body || {}
      let details
      try {
        details = JSON.parse(String(req.body?.details || '{}'))
      } catch {
        details = null
      }
      if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Invalid request type' })
      if (!details || typeof details !== 'object') return res.status(400).json({ error: 'Details are required' })
      if (!req.files || !req.files.length) return res.status(400).json({ error: 'Please upload a valid ID or document for verification' })
      const f1 = req.files[0]
      const f2 = req.files[1] || null
      const id = await run(
        `INSERT INTO account_requests (kind, details, file_name, file_path, file_mime, file_size, file2_name, file2_path, file2_mime, file2_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        kind,
        JSON.stringify(details),
        f1.originalname,
        `/uploads/${f1.filename}`,
        f1.mimetype,
        f1.size,
        f2?.originalname || '',
        f2 ? `/uploads/${f2.filename}` : '',
        f2?.mimetype || '',
        f2?.size || 0
      )
      res.status(201).json({ ok: true, id })
    } catch (err) {
      next(err)
    }
  },
  (err, req, res, next) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large — maximum is 20MB per file' })
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'You can only attach up to 2 files' })
      return res.status(400).json({ error: err.message || 'Upload failed' })
    }
    next()
  }
)

router.use('/requests', requireAuth, requireRole('admin'))

router.get('/requests', async (req, res, next) => {
  try {
    const rows = await all('SELECT * FROM account_requests ORDER BY id DESC')
    res.json(rows.map((r) => ({ ...r, details: JSON.parse(r.details || '{}') })))
  } catch (err) {
    next(err)
  }
})

router.patch('/requests/:id', async (req, res, next) => {
  try {
    const status = req.body?.status
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    const id = Number(req.params.id)
    const existing = await get('SELECT * FROM account_requests WHERE id = ?', id)
    if (!existing) return res.status(404).json({ error: 'Request not found' })
    if (existing.status !== status) {
      if (status === 'approved' || status === 'rejected') {
        let details = {}
        try {
          details = JSON.parse(existing.details || '{}')
        } catch {}
        const email = String(details.email || '').trim()

        await transaction(async (tx) => {
          await tx.run('UPDATE account_requests SET status = ? WHERE id = ?', status, id)
          if (status === 'approved' && email) {
            await tx.run('UPDATE users SET is_verified = 1 WHERE lower(email) = lower(?)', email)
          }
        })

        if (email) {
          sendAccountRequestEmail({
            to: email,
            kind: existing.kind,
            orgName: details.company || details.school || '',
            status
          })
        }
      } else {
        await run('UPDATE account_requests SET status = ? WHERE id = ?', status, id)
      }
    }
    res.json({ ok: true, id })
  } catch (err) {
    next(err)
  }
})

router.delete('/requests/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const existing = await get('SELECT id FROM account_requests WHERE id = ?', id)
    if (!existing) return res.status(404).json({ error: 'Request not found' })
    await run('DELETE FROM account_requests WHERE id = ?', id)
    res.json({ ok: true, id })
  } catch (err) {
    next(err)
  }
})

export default router