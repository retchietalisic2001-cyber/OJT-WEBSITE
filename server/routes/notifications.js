import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const items = await all(
      `SELECT id, type, title, body, link, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 25`,
      req.user.id
    )
    const unread = await get(
      `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0`,
      req.user.id
    )
    res.json({ notifications: items, unread: Number(unread?.c || 0) })
  } catch (err) {
    next(err)
  }
})

router.get('/unread', async (req, res, next) => {
  try {
    const row = await get(
      `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0`,
      req.user.id
    )
    res.json({ total: Number(row?.c || 0) })
  } catch (err) {
    next(err)
  }
})

router.post('/read-all', async (req, res, next) => {
  try {
    await run(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, req.user.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/read', async (req, res, next) => {
  try {
    await run(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      Number(req.params.id),
      req.user.id
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router