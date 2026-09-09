import { Router } from 'express'
import { all, get, run, COURSES } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { haversineKm, CITY_COORDS } from '../services/geo.js'
import { isVerified } from './verify.js'

const router = Router()

function validTags(tags) {
  const arr = Array.isArray(tags) ? tags : String(tags || '').split(',')
  const cleaned = arr.map((t) => t.trim()).filter(Boolean)
  return cleaned.filter((t) => COURSES.includes(t))
}

function parsePostingInput(body) {
  const { title, description, requirements, course_tags, slots, city, address, lat, lng } = body
  return {
    title: String(title || '').trim(),
    description: String(description || '').trim(),
    requirements: String(requirements || '').trim(),
    course_tags: validTags(course_tags).join(','),
    slots: Math.max(1, Number(slots) || 1),
    city: String(city || '').trim(),
    address: String(address || '').trim(),
    lat: lat != null && lat !== '' ? Number(lat) : null,
    lng: lng != null && lng !== '' ? Number(lng) : null
  }
}

router.get('/', requireAuth, async (req, res) => {
  const { course, q, radius, withApplied } = req.query
  const lat = req.query.lat != null ? Number(req.query.lat) : null
  const lng = req.query.lng != null ? Number(req.query.lng) : null
  const radiusKm = radius != null ? Number(radius) : null

  let rows = await all(
    `SELECT p.*, c.company_name, c.industry, c.logo AS company_logo,
            (SELECT COUNT(*) FROM verifications v WHERE v.user_id = c.user_id AND v.status = 'approved') AS verified_count
     FROM postings p JOIN company_profiles c ON c.user_id = p.company_id
     WHERE p.status = 'open'`
  )

  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.city.toLowerCase().includes(needle) ||
        p.address.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle)
    )
  }

  let result = []
  for (const p of rows) {
    const tags = String(p.course_tags || '').split(',').map((t) => t.trim()).filter(Boolean)
    if (course && !tags.includes(String(course))) continue

    const dist =
      p.lat != null && lat != null && lng != null ? haversineKm(lat, lng, p.lat, p.lng) : null
    if (radiusKm != null && dist != null && dist > radiusKm) continue

    result.push({ ...p, is_verified: Boolean(p.verified_count), distance_km: dist, open_slots: Math.max(0, (p.slots || 0)), course_tags: tags })
  }

  let appliedMap = new Map()
  if (withApplied === '1' && req.user.role === 'applicant') {
    const apps = await all('SELECT posting_id, status FROM applications WHERE applicant_id = ?', req.user.id)
    appliedMap = new Map(apps.map((a) => [a.posting_id, a.status]))
  }

  result.forEach((p) => (p.applied_status = appliedMap.get(p.id) || null))

  res.json(result)
})

router.get('/meta/cities', requireAuth, (req, res) => {
  res.json(Object.keys(CITY_COORDS))
})

router.get('/my', requireAuth, requireRole('company'), async (req, res) => {
  const rows = await all(
    `SELECT p.*,
       (SELECT COUNT(*) FROM applications a WHERE a.posting_id = p.id AND a.status != 'withdrawn') AS applicants_count,
       (SELECT COUNT(*) FROM applications a WHERE a.posting_id = p.id AND a.status = 'accepted') AS accepted_count
     FROM postings p WHERE p.company_id = ? ORDER BY p.created_at DESC`,
    req.user.id
  )
  res.json(
    rows.map((p) => ({
      ...p,
      course_tags: String(p.course_tags || '').split(',').map((t) => t.trim()).filter(Boolean)
    }))
  )
})

router.get('/:id', requireAuth, async (req, res) => {
  const p = await get(
    `SELECT p.*, c.company_name, c.industry, c.logo AS company_logo, c.description AS company_description, c.address AS company_address,
            (SELECT COUNT(*) FROM verifications v WHERE v.user_id = c.user_id AND v.status = 'approved') AS verified_count
     FROM postings p JOIN company_profiles c ON c.user_id = p.company_id WHERE p.id = ?`,
    req.params.id
  )
  if (!p) return res.status(404).json({ error: 'Posting not found' })
  p.course_tags = String(p.course_tags || '').split(',').map((t) => t.trim()).filter(Boolean)
  p.is_verified = Boolean(p.verified_count)

  if (req.user.role === 'applicant') {
    const app = await get('SELECT * FROM applications WHERE applicant_id = ? AND posting_id = ? ORDER BY id DESC LIMIT 1', req.user.id, p.id)
    p.applied_status = app?.status || null
    p.application_id = app?.id || null
  }
  res.json(p)
})

router.post('/', requireAuth, requireRole('company'), async (req, res) => {
  if (!(await isVerified(req.user.id)))
    return res.status(403).json({ error: 'Your company must be verified before posting OJT openings. Go to Company Profile → Verification.' })
  const data = parsePostingInput(req.body)
  if (!data.title) return res.status(400).json({ error: 'Posting title is required' })
  if (!data.course_tags) return res.status(400).json({ error: 'Select at least one course' })
  const id = await run(
    `INSERT INTO postings (company_id, title, description, requirements, course_tags, slots, city, address, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    req.user.id,
    data.title,
    data.description,
    data.requirements,
    data.course_tags,
    data.slots,
    data.city,
    data.address,
    data.lat,
    data.lng
  )
  res.status(201).json(await get('SELECT * FROM postings WHERE id = ?', id))
})

router.put('/:id', requireAuth, requireRole('company'), async (req, res) => {
  const p = await get('SELECT * FROM postings WHERE id = ?', req.params.id)
  if (!p) return res.status(404).json({ error: 'Posting not found' })
  if (p.company_id !== req.user.id) return res.status(403).json({ error: 'Not your posting' })
  if (!(await isVerified(req.user.id)))
    return res.status(403).json({ error: 'Your company must be verified before posting OJT openings.' })

  const data = parsePostingInput(req.body)
  await run(
    `UPDATE postings SET title=?, description=?, requirements=?, course_tags=?, slots=?, city=?, address=?, lat=?, lng=? WHERE id=?`,
    data.title || p.title,
    data.description,
    data.requirements,
    data.course_tags || p.course_tags,
    data.slots,
    data.city || p.city,
    data.address || p.address,
    data.lat ?? p.lat,
    data.lng ?? p.lng,
    p.id
  )
  res.json(await get('SELECT * FROM postings WHERE id = ?', p.id))
})

router.patch('/:id/status', requireAuth, requireRole('company'), async (req, res) => {
  const p = await get('SELECT * FROM postings WHERE id = ?', req.params.id)
  if (!p) return res.status(404).json({ error: 'Posting not found' })
  if (p.company_id !== req.user.id) return res.status(403).json({ error: 'Not your posting' })
  const status = req.body?.status === 'open' ? 'open' : 'closed'
  await run('UPDATE postings SET status = ? WHERE id = ?', status, p.id)
  res.json({ id: p.id, status })
})

router.delete('/:id', requireAuth, requireRole('company'), async (req, res) => {
  const p = await get('SELECT * FROM postings WHERE id = ?', req.params.id)
  if (!p) return res.status(404).json({ error: 'Posting not found' })
  if (p.company_id !== req.user.id) return res.status(403).json({ error: 'Not your posting' })
  await run('DELETE FROM postings WHERE id = ?', p.id)
  res.json({ ok: true })
})

export default router
