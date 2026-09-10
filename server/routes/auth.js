import { Router } from 'express'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { get, run, transaction, UPLOADS_DIR, COURSES, YEAR_LEVELS } from '../db.js'
import { signToken, requireAuth, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { profileFor, findOrCreateSchool } from '../services/users.js'
import { matchEnrollmentByStudentId } from './schools.js'

const router = Router()

async function emailTaken(email) {
  return !!(await get('SELECT id FROM users WHERE lower(email) = lower(?)', email))
}

async function usernameTaken(username, excludeId) {
  if (excludeId) return !!(await get('SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?', username, excludeId))
  return !!(await get('SELECT id FROM users WHERE lower(username) = lower(?)', username))
}

async function sendAuth(res, user) {
  const token = signToken(user)
  res.json({ token, user: await profileFor(user) })
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, schoolName, schoolId, course, yearLevel, studentId, phone, username, address, birthdate, gender } = req.body || {}

    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    if (role !== 'applicant') {
      return res.status(403).json({ error: 'Self-registration is for applicants only. Companies and schools are created by an administrator.' })
    }

    const rawPhone = String(phone || '').trim().replace(/[\s\-]/g, '')
    if (!/^(09\d{9}|\+?639\d{9})$/.test(rawPhone)) {
      return res.status(400).json({ error: 'Provide a valid Philippine contact number (e.g. 0917 123 4567)' })
    }

    const uname = String(username || '').trim()
    if (uname.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' })
    if (!/^[a-zA-Z0-9_.-]+$/.test(uname)) return res.status(400).json({ error: 'Username can only contain letters, numbers, dots, dashes and underscores' })

    if (await emailTaken(email)) return res.status(409).json({ error: 'That email is already registered' })
    if (await usernameTaken(uname)) return res.status(409).json({ error: 'That username is already taken' })

    const hash = await bcrypt.hash(password, 10)

    const { id } = await transaction(async (tx) => {
      const id = await tx.run(
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
        school = await tx.get('SELECT * FROM schools WHERE id = ?', schoolId)
      } else if (schoolName) {
        school = await findOrCreateSchool(schoolName)
      }
      await tx.run(
        'INSERT INTO applicant_profiles (user_id, school_id, course, year_level, student_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        school?.id ?? null,
        course && course.trim() ? course.trim() : '',
        YEAR_LEVELS.includes(yearLevel) ? yearLevel : '',
        String(studentId || '').trim(),
        String(phone || '').trim()
      )

      return { id }
    })

    if (studentId || email) {
      try {
        await matchEnrollmentByStudentId(id, studentId, email)
      } catch {}
    }

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

router.put('/password', requireAuth, async (req, res, next) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', req.user.id)
    if (!user) return res.status(401).json({ error: 'Account not found' })

    const newPassword = String(req.body?.newPassword || '')
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })

    const mustChange = !!Number(user.must_change_password)
    if (!mustChange) {
      const currentPassword = String(req.body?.currentPassword || '')
      const ok = await bcrypt.compare(currentPassword, user.password_hash)
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const same = await bcrypt.compare(newPassword, user.password_hash)
    if (same) return res.status(400).json({ error: 'New password must be different from your current password' })

    const hash = await bcrypt.hash(newPassword, 10)
    await run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', hash, user.id)

    const updated = await get('SELECT * FROM users WHERE id = ?', user.id)
    res.json({ ok: true, user: await profileFor(updated) })
  } catch (err) {
    next(err)
  }
})

router.put(
  '/avatar',
  requireAuth,
  upload.single('avatar'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Please choose an image to upload' })
    if (!String(req.file.mimetype).startsWith('image/'))
      return res.status(400).json({ error: 'Profile picture must be an image (PNG, JPG, WebP or GIF)' })

    const prev = (await get('SELECT avatar FROM users WHERE id = ?', req.user.id))?.avatar || ''
    await run('UPDATE users SET avatar = ? WHERE id = ?', `/uploads/${req.file.filename}`, req.user.id)

    if (prev && prev.startsWith('/uploads/')) {
      const oldFile = path.join(UPLOADS_DIR, path.basename(prev))
      try {
        fs.unlinkSync(oldFile)
      } catch {}
    }

    const user = await get('SELECT * FROM users WHERE id = ?', req.user.id)
    res.json(await profileFor(user))
  },
  (err, req, res, next) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  }
)

router.put(
  '/logo',
  requireAuth,
  requireRole('company', 'school'),
  upload.single('logo'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Please choose an image to upload' })
    if (!String(req.file.mimetype).startsWith('image/'))
      return res.status(400).json({ error: 'Logo must be an image (PNG, JPG, WebP or GIF)' })

    let prev = ''
    if (req.user.role === 'company') {
      prev = (await get('SELECT logo FROM company_profiles WHERE user_id = ?', req.user.id))?.logo || ''
      await run('UPDATE company_profiles SET logo = ? WHERE user_id = ?', `/uploads/${req.file.filename}`, req.user.id)
    } else {
      const coord = await get('SELECT * FROM school_coordinators WHERE user_id = ?', req.user.id)
      if (!coord?.school_id) return res.status(400).json({ error: 'Link your school in your profile before uploading its logo' })
      prev = (await get('SELECT logo FROM schools WHERE id = ?', coord.school_id))?.logo || ''
      await run('UPDATE schools SET logo = ? WHERE id = ?', `/uploads/${req.file.filename}`, coord.school_id)
    }

    if (prev && prev.startsWith('/uploads/')) {
      const oldFile = path.join(UPLOADS_DIR, path.basename(prev))
      try {
        fs.unlinkSync(oldFile)
      } catch {}
    }

    const user = await get('SELECT * FROM users WHERE id = ?', req.user.id)
    res.json(await profileFor(user))
  },
  (err, req, res, next) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  }
)

router.put('/profile', requireAuth, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', req.user.id)
  const p = req.body || {}

  if (user.role === 'applicant') {
    const course = (p.course && p.course.trim()) ? p.course.trim() : (await get('SELECT course FROM applicant_profiles WHERE user_id = ?', user.id))?.course || ''
    const yearLevel = YEAR_LEVELS.includes(p.yearLevel) ? p.yearLevel : (await get('SELECT year_level FROM applicant_profiles WHERE user_id = ?', user.id))?.year_level || ''
    let schoolId = (await get('SELECT school_id FROM applicant_profiles WHERE user_id = ?', user.id))?.school_id ?? null
    if (p.schoolId) schoolId = Number(p.schoolId)
    else if (p.schoolName) schoolId = (await findOrCreateSchool(p.schoolName)).id
    const prevStudentId = (await get('SELECT student_id FROM applicant_profiles WHERE user_id = ?', user.id))?.student_id || ''
    const newStudentId = String(p.studentId ?? prevStudentId).trim()

    await run(
      `UPDATE applicant_profiles SET school_id=?, course=?, year_level=?, student_id=?, phone=?, search_city=?, search_lat=?, search_lng=?, search_radius=? WHERE user_id=?`,
      schoolId,
      course,
      yearLevel,
      newStudentId,
      String(p.phone ?? '').trim(),
      String(p.searchCity ?? '').trim(),
      p.searchLat != null ? Number(p.searchLat) : null,
      p.searchLng != null ? Number(p.searchLng) : null,
      p.searchRadius != null && Number(p.searchRadius) > 0 ? Math.min(Number(p.searchRadius), 100) : 25,
      user.id
    )

    if (newStudentId) {
      try {
        await matchEnrollmentByStudentId(user.id, newStudentId)
      } catch {}
    }
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
    if (await usernameTaken(nu, user.id)) return res.status(409).json({ error: 'That username is already taken' })
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