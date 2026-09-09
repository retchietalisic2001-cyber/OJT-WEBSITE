import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { get, run, COURSES, YEAR_LEVELS } from '../db.js'
import { signToken, requireAuth } from '../middleware/auth.js'
import { profileFor, findOrCreateSchool } from '../services/users.js'

const router = Router()

async function emailTaken(email) {
  return !!(await get('SELECT id FROM users WHERE lower(email) = lower(?)', email))
}

async function usernameTaken(username) {
  return !!(await get('SELECT id FROM users WHERE lower(username) = lower(?)', username))
}

async function sendAuth(res, user) {
  const token = signToken(user)
  res.json({ token, user: await profileFor(user) })
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, schoolName, schoolId, course, yearLevel, phone, username, address, birthdate, gender } = req.body || {}

    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    if (role !== 'applicant') {
      return res.status(403).json({ error: 'Self-registration is for applicants only. Companies and schools are created by an administrator.' })
    }

    const uname = String(username || '').trim()
    if (uname.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' })
    if (!/^[a-zA-Z0-9_.-]+$/.test(uname)) return res.status(400).json({ error: 'Username can only contain letters, numbers, dots, dashes and underscores' })

    if (await emailTaken(email)) return res.status(409).json({ error: 'That email is already registered' })
    if (await usernameTaken(uname)) return res.status(409).json({ error: 'That username is already taken' })

    const hash = await bcrypt.hash(password, 10)
    const id = await run(
      'INSERT INTO users (name, email, username, password_hash, role, phone, address, birthdate, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      name.trim(),
      email.trim().toLowerCase(),
      uname,
      hash,
      role,
      String(phone || '').trim(),
      String(address || '').trim(),
      String(birthdate || '').trim(),
      String(gender || '').trim()
    )

    let school = null
    if (schoolId) {
      school = await get('SELECT * FROM schools WHERE id = ?', schoolId)
    } else if (schoolName) {
      school = await findOrCreateSchool(schoolName)
    }
    await run(
      'INSERT INTO applicant_profiles (user_id, school_id, course, year_level, phone) VALUES (?, ?, ?, ?, ?)',
      id,
      school?.id ?? null,
      course && course.trim() ? course.trim() : '',
      YEAR_LEVELS.includes(yearLevel) ? yearLevel : '',
      String(phone || '').trim()
    )

    const user = { id, name: name.trim(), email: email.trim().toLowerCase(), role, username: uname, phone: String(phone || '').trim(), address: String(address || '').trim(), birthdate: String(birthdate || '').trim(), gender: String(gender || '').trim() }
    await sendAuth(res, user)
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    const identifier = String(email || '').trim()
    const user = await get('SELECT * FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)', identifier, identifier)
    if (!user) return res.status(401).json({ error: 'Invalid email/username or password' })

    const ok = await bcrypt.compare(String(password || ''), user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid email/username or password' })

    await sendAuth(res, user)
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', req.user.id)
  if (!user) return res.status(401).json({ error: 'Account not found' })
  res.json(await profileFor(user))
})

router.put('/profile', requireAuth, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', req.user.id)
  const p = req.body || {}

  if (user.role === 'applicant') {
    const course = (p.course && p.course.trim()) ? p.course.trim() : (await get('SELECT course FROM applicant_profiles WHERE user_id = ?', user.id))?.course || ''
    const yearLevel = YEAR_LEVELS.includes(p.yearLevel) ? p.yearLevel : (await get('SELECT year_level FROM applicant_profiles WHERE user_id = ?', user.id))?.year_level || ''
    let schoolId = (await get('SELECT school_id FROM applicant_profiles WHERE user_id = ?', user.id))?.school_id ?? null
    if (p.schoolId) schoolId = Number(p.schoolId)
    else if (p.schoolName) schoolId = (await findOrCreateSchool(p.schoolName)).id

    await run(
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
    await run(
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
    let schoolId = (await get('SELECT school_id FROM school_coordinators WHERE user_id = ?', user.id))?.school_id ?? null
    if (p.schoolId) schoolId = Number(p.schoolId)
    else if (p.schoolName) schoolId = (await findOrCreateSchool(p.schoolName)).id
    await run('UPDATE school_coordinators SET school_id=?, position=? WHERE user_id=?', schoolId, String(p.position ?? '').trim(), user.id)
  }

  if (p.name) {
    const newName = String(p.name).trim()
    if (newName) await run('UPDATE users SET name = ? WHERE id = ?', newName, user.id)
  }
  if (p.username !== undefined) {
    const nu = String(p.username || '').trim()
    if (nu.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' })
    if (await usernameTaken(nu)) return res.status(409).json({ error: 'That username is already taken' })
    await run('UPDATE users SET username = ? WHERE id = ?', nu, user.id)
  }
  await run(
    'UPDATE users SET phone=?, address=?, birthdate=?, gender=? WHERE id=?',
    String(p.phone ?? '').trim(),
    String(p.address ?? '').trim(),
    String(p.birthdate ?? '').trim(),
    String(p.gender ?? '').trim(),
    user.id
  )

  res.json(await profileFor(await get('SELECT * FROM users WHERE id = ?', user.id)))
})

export default router