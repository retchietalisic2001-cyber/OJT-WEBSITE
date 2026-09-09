import { Router } from 'express'
import { get, transaction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { recommendPostings, generateCover } from '../services/recommender.js'
import { attachResumeToApplication } from './resume.js'

const router = Router()

router.get('/', requireAuth, requireRole('applicant'), async (req, res, next) => {
  try {
    const profile = (await get('SELECT * FROM applicant_profiles WHERE user_id = ?', req.user.id)) || {}
    const limit = Math.min(Number(req.query.limit) || 6, 12)
    res.json(await recommendPostings(profile, limit))
  } catch (err) {
    next(err)
  }
})

router.post('/auto-apply', requireAuth, requireRole('applicant'), async (req, res, next) => {
  try {
    const profile = (await get('SELECT * FROM applicant_profiles WHERE user_id = ?', req.user.id)) || {}
    const applicant = await get('SELECT id, name FROM users WHERE id = ?', req.user.id)

    const resumeRow = await get('SELECT data FROM resumes WHERE applicant_id = ?', req.user.id)
    let hasResume = false
    if (resumeRow?.data) {
      try {
        const d = JSON.parse(resumeRow.data)
        hasResume = !!(d.summary || d.skills?.length || d.education?.length || d.experience?.length)
      } catch {}
    }
    if (!hasResume) {
      return res.status(400).json({ error: 'Build your resume first in the Resume Builder to use AI auto-apply' })
    }

    const count = Math.min(Number(req.body?.count) || 3, 5)
    const suggestions = await recommendPostings(profile, 8)

    const results = { applied: [], skipped: [], failed: [] }
    for (const posting of suggestions) {
      if (results.applied.length >= count) break
      try {
        const existing = await get(
          `SELECT id FROM applications WHERE applicant_id = ? AND posting_id = ? AND status NOT IN ('rejected','withdrawn')`,
          req.user.id,
          posting.id
        )
        if (existing) {
          results.skipped.push(posting.id)
          continue
        }
        const cover = generateCover({
          applicantName: (applicant?.name || 'a student').split(' ').slice(0, 2).join(' '),
          course: profile.course,
          yearLevel: profile.year_level,
          posting
        })
        const id = await transaction(async (tx) => {
          const id = await tx.run(
            'INSERT INTO applications (posting_id, applicant_id, cover_message, status) VALUES (?, ?, ?, ?)',
            posting.id,
            req.user.id,
            cover,
            'submitted'
          )
          await tx.run(
            'INSERT INTO status_history (application_id, status, note) VALUES (?, ?, ?)',
            id,
            'submitted',
            'Application sent automatically by AI match'
          )
          return id
        })
        results.applied.push(id)
      } catch (err) {
        results.failed.push({ posting_id: posting.id, error: err.message })
      }
    }

    res.status(201).json(results)
  } catch (err) {
    next(err)
  }
})

export default router