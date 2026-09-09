import bcrypt from 'bcryptjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, run, get, initSchema, DB_MODE } from './db.js'

async function execSql(sql) {
  if (DB_MODE === 'mysql') {
    const parts = sql.split(';').map((s) => s.trim()).filter(Boolean)
    for (const part of parts) {
      await db.query(part)
    }
  } else {
    db.exec(sql)
  }
}

export async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@ojtconnect.com').toLowerCase()
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  if (await get('SELECT id FROM users WHERE role = ?', 'admin')) return
  const hash = await bcrypt.hash(password, 10)
  await run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'OJT Connect Admin', email, hash, 'admin')
  console.log(`\n  [admin] Created administrator account: ${email} / ${password}\n  [admin] Please change this password after your first login.\n`)
}

export async function seedDatabase() {
  console.log('Preparing OJT Connect database...')
  await initSchema()

  await execSql('DELETE FROM enrollments; DELETE FROM school_rooms; DELETE FROM school_courses;')
  await execSql('DELETE FROM messages; DELETE FROM status_history; DELETE FROM applications; DELETE FROM resumes;')
  await execSql('DELETE FROM postings; DELETE FROM applicant_profiles; DELETE FROM company_profiles; DELETE FROM school_coordinators;')
  await execSql('DELETE FROM verifications; DELETE FROM account_requests; DELETE FROM users WHERE role != \'admin\'; DELETE FROM schools;')
  if (DB_MODE === 'sqlite') {
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('enrollments','school_rooms','school_courses','messages','status_history','applications','resumes','postings','applicant_profiles','company_profiles','school_coordinators','verifications','account_requests','users','schools');")
  }

  await ensureAdmin()
  console.log('  Database reset — sample data removed. Only administrator accounts remain.\n')
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  seedDatabase().then(async () => {
    if (DB_MODE === 'mysql' && typeof db.end === 'function') {
      await db.end()
    }
    process.exit(0)
  }).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}