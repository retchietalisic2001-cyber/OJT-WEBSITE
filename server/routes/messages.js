import { Router } from 'express'
import { all, get, run, nowTs } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { upload, mimeCategory } from '../middleware/upload.js'
import { createNotification } from '../services/notifications.js'

const router = Router()

router.use(requireAuth)

async function loadCtx(applicationId) {
  return get(
    `SELECT a.*, p.company_id, a.applicant_id FROM applications a
     JOIN postings p ON p.id = a.posting_id WHERE a.id = ?`,
    applicationId
  )
}

router.use('/:applicationId', async (req, res, next) => {
  const ctx = await loadCtx(req.params.applicationId)
  if (!ctx) return res.status(404).json({ error: 'Application not found' })

  const isApplicant = ctx.applicant_id === req.user.id
  const isCompany = req.user.role === 'company' && ctx.company_id === req.user.id
  if (!isApplicant && !isCompany) return res.status(403).json({ error: 'No access to this conversation' })

  req.appCtx = ctx
  next()
})

function serializeMessage(m) {
  return { ...m, category: mimeCategory(m.file_mime) }
}

function emitNewMessage(req, message) {
  const io = req.app.get('io')
  if (io) io.to(`app-${req.appCtx.id}`).emit('message:new', serializeMessage(message))
}

function notifyChatRecipient(req, message) {
  const isApplicant = req.user.role === 'applicant'
  const recipientId = isApplicant ? req.appCtx.company_id : req.appCtx.applicant_id
  const io = req.app.get('io')
  const preview = (message.content || message.file_name || 'Message').slice(0, 120)
  createNotification({
    userId: recipientId,
    type: 'chat',
    title: isApplicant ? 'New message from company' : 'New message from applicant',
    body: `${req.user.name}: ${preview}`,
    link: isApplicant ? `/app/messages?application=${req.appCtx.id}` : `/company/applications/${req.appCtx.id}`,
    io
  })
}

router.get('/:applicationId', async (req, res) => {
  const messages = await all(
    'SELECT * FROM messages WHERE application_id = ? ORDER BY id ASC',
    req.params.applicationId
  )
  await run(
    'UPDATE messages SET is_read = 1 WHERE application_id = ? AND sender_id != ?',
    req.params.applicationId,
    req.user.id
  )
  res.json(messages.map(serializeMessage))
})

router.post('/:applicationId', async (req, res) => {
  const content = String(req.body?.content || '').trim()
  if (!content) return res.status(400).json({ error: 'Message is empty' })
  const id = await run(
    'INSERT INTO messages (application_id, sender_id, sender_role, content) VALUES (?, ?, ?, ?)',
    req.params.applicationId,
    req.user.id,
    req.user.role,
    content
  )
  const message = await get('SELECT * FROM messages WHERE id = ?', id)
  emitNewMessage(req, message)
  notifyChatRecipient(req, message)
  res.status(201).json(serializeMessage(message))
})

router.post(
  '/:applicationId/upload',
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received' })
    const content = String(req.body?.content || '').trim()

    const id = await run(
      `INSERT INTO messages (application_id, sender_id, sender_role, content, file_name, file_path, file_mime, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      req.params.applicationId,
      req.user.id,
      req.user.role,
      content,
      req.file.originalname,
      `/uploads/${req.file.filename}`,
      req.file.mimetype,
      req.file.size
    )
    const message = await get('SELECT * FROM messages WHERE id = ?', id)
    emitNewMessage(req, message)
    notifyChatRecipient(req, message)
    res.status(201).json(serializeMessage(message))
  },
  (err, req, res, next) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  }
)

router.post('/:applicationId/seen', async (req, res) => {
  await run('UPDATE messages SET is_read = 1 WHERE application_id = ? AND sender_id != ?', req.params.applicationId, req.user.id)
  res.json({ ok: true })
})

export default router
