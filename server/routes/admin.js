import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { get, run, all } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { findOrCreateSchool } from '../services/users.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

const EMAIL_RE = /^\S+@\S+\.\S+$/
const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/

async function identifierTaken(email, username) {
  if (!username) {
    return !!(
      await get('SELECT id FROM users WHERE lower(email) = lower(?)', email)
    )
  }
  return !!(
    await get(
      'SELECT id FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)',
      email,
      username
    )
  )
}

router.get('/users', async (req, res, next) => {
  try {
    const companies = await all(
      `SELECT u.id, u.name, u.email, u.username, u.phone, u.created_at,
              c.company_name, c.industry, c.description, c.address
       FROM users u JOIN company_profiles c ON c.user_id = u.id
       WHERE u.role = 'company' ORDER BY u.id DESC`
    )
    const schools = await all(
      `SELECT u.id, u.name, u.email, u.username, u.phone, u.created_at,
              s.name AS school_name, sc.position
       FROM users u
       JOIN school_coordinators sc ON sc.user_id = u.id
       JOIN schools s ON s.id = sc.school_id
       WHERE u.role = 'school' ORDER BY u.id DESC`
    )
    res.json({ companies, schools })
  } catch (err) {
    next(err)
  }
})

router.post('/users/company', async (req, res, next) => {
  try {
    const { name, email, username, password, phone, companyName, industry, description, address } = req.body || {}
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({ error: 'Coordinator name, email, password and company name are required' })
    }
    const cleanEmail = String(email).trim().toLowerCase()
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Invalid email address' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const uname = String(username || '').trim()
    if (uname && uname.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' })
    if (uname && !USERNAME_RE.test(uname)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, dots, dashes and underscores' })
    }

    if (await identifierTaken(cleanEmail, uname)) return res.status(409).json({ error: 'That email or username is already in use' })

    const hash = await bcrypt.hash(password, 10)
    const id = await run(
      'INSERT INTO users (name, email, username, password_hash, role, phone, is_verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
      String(name).trim(),
      cleanEmail,
      uname || null,
      hash,
      'company',
      String(phone || '').trim()
    )
    await run(
      'INSERT INTO company_profiles (user_id, company_name, industry, description, address) VALUES (?, ?, ?, ?, ?)',
      id,
      String(companyName).trim(),
      String(industry || '').trim(),
      String(description || '').trim(),
      String(address || '').trim()
    )
    res.status(201).json({ ok: true, id })
  } catch (err) {
    next(err)
  }
})

router.post('/users/school', async (req, res, next) => {
  try {
    const { name, email, username, password, phone, schoolName, position } = req.body || {}
    if (!name || !email || !password || !schoolName) {
      return res.status(400).json({ error: 'Coordinator name, email, password and school are required' })
    }
    const cleanEmail = String(email).trim().toLowerCase()
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Invalid email address' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const uname = String(username || '').trim()
    if (uname && uname.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' })
    if (uname && !USERNAME_RE.test(uname)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, dots, dashes and underscores' })
    }

    if (await identifierTaken(cleanEmail, uname)) return res.status(409).json({ error: 'That email or username is already in use' })

    const school = await findOrCreateSchool(schoolName)
    const hash = await bcrypt.hash(password, 10)
    const id = await run(
      'INSERT INTO users (name, email, username, password_hash, role, phone, is_verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
      String(name).trim(),
      cleanEmail,
      uname || null,
      hash,
      'school',
      String(phone || '').trim()
    )
    await run(
      'INSERT INTO school_coordinators (user_id, school_id, position) VALUES (?, ?, ?)',
      id,
      school.id,
      String(position || '').trim() || 'OJT Coordinator'
    )
    res.status(201).json({ ok: true, id })
  } catch (err) {
    next(err)
  }
})

router.get('/users/all', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT u.id, u.name, u.email, u.username, u.phone, u.role, u.created_at,
              c.company_name,
              s.name AS school_name,
              (SELECT COUNT(*) FROM verifications v WHERE v.user_id = u.id AND v.status = 'approved') AS approved_docs,
              (SELECT COUNT(*) FROM verifications v WHERE v.user_id = u.id AND v.status = 'pending') AS pending_docs,
              (SELECT COUNT(*) FROM postings p WHERE p.company_id = u.id) AS postings_count
       FROM users u
       LEFT JOIN company_profiles c ON c.user_id = u.id
       LEFT JOIN school_coordinators sc ON sc.user_id = u.id
       LEFT JOIN schools s ON s.id = sc.school_id
       ORDER BY u.id DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.delete('/users/:id', async (req, res, next) => {
  try {
    const u = await get('SELECT * FROM users WHERE id = ?', Number(req.params.id))
    if (!u) return res.status(404).json({ error: 'Account not found' })
    if (u.role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot be deleted here' })
    await run('DELETE FROM users WHERE id = ?', u.id)
    res.json({ ok: true, id: u.id })
  } catch (err) {
    next(err)
  }
})

export default router