import { Router } from 'express'
import { get } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { recommendPostings } from '../services/recommender.js'

const router = Router()

router.get('/', requireAuth, requireRole('applicant'), async (req, res) => {
  const profile = (await get('SELECT * FROM applicant_profiles WHERE user_id = ?', req.user.id)) || {}
  const limit = Math.min(Number(req.query.limit) || 6, 12)
  res.json(await recommendPostings(profile, limit))
})

export default router