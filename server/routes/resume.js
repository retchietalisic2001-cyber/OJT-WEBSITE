import { Router } from 'express'
import { get, run, nowTs } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { skillSuggestions, objectiveFor } from '../services/skills.js'
import { generateResumePdf } from '../services/pdf.js'

const router = Router()

router.use(requireAuth)

const DEFAULT_RESUME = {
  summary: '',
  skills: [],
  education: [],
  experience: [],
  projects: [],
  certifications: []
}

async function loadResume(userId) {
  const row = await get('SELECT * FROM resumes WHERE applicant_id = ?', userId)
  if (!row) return { applicant_id: userId, data: { ...DEFAULT_RESUME }, updated_at: null }
  let data
  try {
    data = JSON.parse(row.data)
  } catch {
    data = { ...DEFAULT_RESUME }
  }
  return { ...row, data: { ...DEFAULT_RESUME, ...data } }
}

router.get('/my', requireRole('applicant'), async (req, res) => {
  const resume = await loadResume(req.user.id)
  res.json(resume)
})

router.put('/my', requireRole('applicant'), async (req, res) => {
  const { data } = req.body || {}
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Invalid resume data' })

  const normalized = {
    summary: String(data.summary || '').trim(),
    skills: Array.isArray(data.skills) ? data.skills.filter(Boolean).map(String) : [],
    education: Array.isArray(data.education) ? data.education : [],
    experience: Array.isArray(data.experience) ? data.experience : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    certifications: Array.isArray(data.certifications) ? data.certifications : []
  }

  const existing = await get('SELECT applicant_id FROM resumes WHERE applicant_id = ?', req.user.id)
  if (existing) {
    await run('UPDATE resumes SET data = ?, updated_at = ? WHERE applicant_id = ?', JSON.stringify(normalized), nowTs(), req.user.id)
  } else {
    await run('INSERT INTO resumes (applicant_id, data, updated_at) VALUES (?, ?, ?)', req.user.id, JSON.stringify(normalized), nowTs())
  }
  res.json(await loadResume(req.user.id))
})

router.get('/suggestions', requireRole('applicant'), (req, res) => {
  const course = req.query.course
  res.json({
    skills: skillSuggestions(course),
    objective: objectiveFor(course)
  })
})

export async function attachResumeToApplication({ applicationId, applicantId, app }) {
  const ctx = await get(
    `SELECT a.id, a.applicant_id, p.company_id FROM applications a JOIN postings p ON p.id = a.posting_id WHERE a.id = ?`,
    Number(applicationId)
  )
  if (!ctx) return { attached: false, error: 'Application not found' }
  if (ctx.applicant_id !== applicantId) return { attached: false, error: 'Not your application' }

  const resume = await loadResume(applicantId)
  const hasAny =
    resume.data.summary ||
    resume.data.skills.length ||
    resume.data.education.length ||
    resume.data.experience.length
  if (!hasAny) return { attached: false, reason: 'empty' }

  const applicant = await get('SELECT id, name, email FROM users WHERE id = ?', applicantId)
  const profile = await get('SELECT * FROM applicant_profiles WHERE user_id = ?', applicantId)
  const school = profile?.school_id ? await get('SELECT name FROM schools WHERE id = ?', profile.school_id) : null
  const filename = `resume_${applicantId}_${Date.now()}.pdf`
  await generateResumePdf(applicant, profile, school?.name, resume, filename)

  const id = await run(
    `INSERT INTO messages (application_id, sender_id, sender_role, content, file_name, file_path, file_mime, file_size)
     VALUES (?, ?, 'applicant', ?, ?, ?, 'application/pdf', 0)`,
    ctx.id,
    applicantId,
    `Here is my resume — please review.`,
    `Resume_${applicant.name.replace(/[^a-zA-Z ]/g, '').split(' ').slice(0, 2).join('_')}.pdf`,
    `/uploads/${filename}`
  )
  const message = await get('SELECT * FROM messages WHERE id = ?', id)
  const io = app?.get && app.get('io')
  if (io) io.to(`app-${ctx.id}`).emit('message:new', { ...message, category: 'pdf' })
  return { attached: true, message: { ...message, category: 'pdf' } }
}

router.post('/applications/:applicationId/attach-resume', requireRole('applicant'), async (req, res, next) => {
  try {
    const result = await attachResumeToApplication({
      applicationId: Number(req.params.applicationId),
      applicantId: req.user.id,
      app: req.app
    })
    if (result.error) {
      const status = result.error === 'Application not found' ? 404 : 403
      return res.status(status).json({ error: result.error })
    }
    if (result.reason === 'empty') return res.status(400).json({ error: 'Build your resume first in the Resume Builder' })
    res.status(201).json({ ok: true, message: result.message })
  } catch (err) {
    next(err)
  }
})

export default router
