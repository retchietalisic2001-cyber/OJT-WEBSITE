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

function loadResume(userId) {
  const row = get('SELECT * FROM resumes WHERE applicant_id = ?', userId)
  if (!row) return { applicant_id: userId, data: { ...DEFAULT_RESUME }, updated_at: null }
  let data
  try {
    data = JSON.parse(row.data)
  } catch {
    data = { ...DEFAULT_RESUME }
  }
  return { ...row, data: { ...DEFAULT_RESUME, ...data } }
}

router.get('/my', requireRole('applicant'), (req, res) => {
  const resume = loadResume(req.user.id)
  res.json(resume)
})

router.put('/my', requireRole('applicant'), (req, res) => {
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

  const existing = get('SELECT applicant_id FROM resumes WHERE applicant_id = ?', req.user.id)
  if (existing) {
    run('UPDATE resumes SET data = ?, updated_at = ? WHERE applicant_id = ?', JSON.stringify(normalized), nowTs(), req.user.id)
  } else {
    run('INSERT INTO resumes (applicant_id, data, updated_at) VALUES (?, ?, ?)', req.user.id, JSON.stringify(normalized), nowTs())
  }
  res.json(loadResume(req.user.id))
})

router.get('/suggestions', requireRole('applicant'), (req, res) => {
  const course = req.query.course
  res.json({
    skills: skillSuggestions(course),
    objective: objectiveFor(course)
  })
})

router.post('/applications/:applicationId/attach-resume', requireRole('applicant'), async (req, res, next) => {
  try {
    const ctx = get(
      `SELECT a.id, a.applicant_id, p.company_id FROM applications a JOIN postings p ON p.id = a.posting_id WHERE a.id = ?`,
      Number(req.params.applicationId)
    )
    if (!ctx) return res.status(404).json({ error: 'Application not found' })
    if (ctx.applicant_id !== req.user.id) return res.status(403).json({ error: 'Not your application' })

    const resume = loadResume(req.user.id)
    const hasAny =
      resume.data.summary ||
      resume.data.skills.length ||
      resume.data.education.length ||
      resume.data.experience.length
    if (!hasAny) return res.status(400).json({ error: 'Build your resume first in the Resume Builder' })

    const applicant = get('SELECT id, name, email FROM users WHERE id = ?', req.user.id)
    const profile = get('SELECT * FROM applicant_profiles WHERE user_id = ?', req.user.id)
    const school = profile?.school_id ? get('SELECT name FROM schools WHERE id = ?', profile.school_id) : null
    const filename = `resume_${req.user.id}_${Date.now()}.pdf`
    await generateResumePdf(applicant, profile, school?.name, resume, filename)

    const id = run(
      `INSERT INTO messages (application_id, sender_id, sender_role, content, file_name, file_path, file_mime, file_size)
       VALUES (?, ?, 'applicant', ?, ?, ?, 'application/pdf', 0)`,
      ctx.id,
      req.user.id,
      `Here is my resume — please review.`,
      `Resume_${applicant.name.replace(/[^a-zA-Z ]/g, '').split(' ').slice(0, 2).join('_')}.pdf`,
      `/uploads/${filename}`
    )
    const message = get('SELECT * FROM messages WHERE id = ?', id)
    const io = req.app.get('io')
    if (io) io.to(`app-${ctx.id}`).emit('message:new', { ...message, category: 'pdf' })
    res.status(201).json({ ok: true, message: { ...message, category: 'pdf' } })
  } catch (err) {
    next(err)
  }
})

export default router