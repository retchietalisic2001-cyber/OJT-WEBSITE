import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { get, run, COURSES, YEAR_LEVELS } from '../db.js'
import { signToken, requireAuth } from '../middleware/auth.js'
import { profileFor, findOrCreateSchool } from '../services/users.js'

const router = Router()

function emailTaken(email) {
  return !!get('SELECT id FROM users WHERE lower(email) = lower(?)', email)
}

function sendAuth(res, user) {
  const token = signToken(user)
  res.json({ token, user: profileFor(user) })
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, schoolName, schoolId, course, yearLevel, phone, companyName, industry, position } = req.body || {}

    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const validRoles = ['school', 'applicant', 'company']
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' })
    if (emailTaken(email)) return res.status(409).json({ error: 'That email is already registered' })

    const hash = await bcrypt.hash(password, 10)
    const id = run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', name.trim(), email.trim().toLowerCase(), hash, role)

    if (role === 'school') {
      const school = findOrCreateSchool(schoolName)
      run('INSERT INTO school_coordinators (user_id, school_id, position) VALUES (?, ?, ?)', id, school.id, position || 'OJT Coordinator')
    }

    if (role === 'applicant') {
      let school = null
      if (schoolId) {
        school = get('SELECT * FROM schools WHERE id = ?', schoolId)
      } else if (schoolName) {
        school = findOrCreateSchool(schoolName)
      }
      run(
        'INSERT INTO applicant_profiles (user_id, school_id, course, year_level, phone) VALUES (?, ?, ?, ?, ?)',
        id,
        school?.id ?? null,
        COURSES.includes(course) ? course : '',
        YEAR_LEVELS.includes(yearLevel) ? yearLevel : '',
        String(phone || '').trim()
      )
    }

    if (role === 'company') {
      run(
        'INSERT INTO company_profiles (user_id, company_name, industry) VALUES (?, ?, ?)',
        id,
        String(companyName || '').trim(),
        String(industry || '').trim()
      )
    }

    const user = { id, name: name.trim(), email: email.trim().toLowerCase(), role }
    sendAuth(res, user)
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    const user = get('SELECT * FROM users WHERE lower(email) = lower(?)', String(email || '').trim())
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    const ok = await bcrypt.compare(String(password || ''), user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' })

    sendAuth(res, user)
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', req.user.id)
  if (!user) return res.status(401).json({ error: 'Account not found' })
  res.json(profileFor(user))
})

router.put('/profile', requireAuth, (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', req.user.id)
  const p = req.body || {}

  if (user.role === 'applicant') {
    const course = COURSES.includes(p.course) ? p.course : get('SELECT course FROM applicant_profiles WHERE user_id = ?', user.id)?.course || ''
    const yearLevel = YEAR_LEVELS.includes(p.yearLevel) ? p.yearLevel : get('SELECT year_level FROM applicant_profiles WHERE user_id = ?', user.id)?.year_level || ''
    let schoolId = get('SELECT school_id FROM applicant_profiles WHERE user_id = ?', user.id)?.school_id ?? null
    if (p.schoolId) schoolId = Number(p.schoolId)
    else if (p.schoolName) schoolId = findOrCreateSchool(p.schoolName).id

    run(
      `UPDATE applicant_profiles SET school_id=?, course=?, year_level=?, phone=?, search_city=?, search_lat=?, search_lng=? WHERE user_id=?`,
      schoolId,
      course,
      yearLevel,
      String(p.phone ?? '').trim(),
      String(p.searchCity ?? '').trim(),
      p.searchLat != null ? Number(p.searchLat) : null,
      p.searchLng != null ? Number(p.searchLng) : null,
      user.id
    )
  }

  if (user.role === 'company') {
    run(
      `UPDATE company_profiles SET company_name=?, industry=?, description=?, address=?, lat=?, lng=? WHERE user_id=?`,
      String(p.companyName ?? '').trim(),
      String(p.industry ?? '').trim(),
      String(p.description ?? '').trim(),
      String(p.address ?? '').trim(),
      p.lat != null ? Number(p.lat) : null,
      p.lng != null ? Number(p.lng) : null,
      user.id
    )
  }

  if (user.role === 'school') {
    let schoolId = get('SELECT school_id FROM school_coordinators WHERE user_id = ?', user.id)?.school_id ?? null
    if (p.schoolId) schoolId = Number(p.schoolId)
    else if (p.schoolName) schoolId = findOrCreateSchool(p.schoolName).id
    run('UPDATE school_coordinators SET school_id=?, position=? WHERE user_id=?', schoolId, String(p.position ?? '').trim(), user.id)
  }

  if (p.name) run('UPDATE users SET name = ? WHERE id = ?', String(p.name).trim(), user.id)

  res.json(profileFor(get('SELECT * FROM users WHERE id = ?', user.id)))
})

export default router