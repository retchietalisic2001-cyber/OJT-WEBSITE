import { db, get } from '../db.js'

export function profileFor(user) {
  const base = { id: user.id, name: user.name, email: user.email, role: user.role }
  if (user.role === 'applicant') {
    const p = get('SELECT * FROM applicant_profiles WHERE user_id = ?', user.id)
    let school = null
    let schoolName = p?.school_name || ''
    if (p?.school_id) {
      school = get('SELECT name FROM schools WHERE id = ?', p.school_id)
      schoolName = school?.name || schoolName
    }
    return { ...base, school_name: schoolName, profile: { ...p, school_name: schoolName } }
  }
  if (user.role === 'company') {
    const p = get('SELECT * FROM company_profiles WHERE user_id = ?', user.id)
    return { ...base, profile: p }
  }
  if (user.role === 'school') {
    const coord = get('SELECT * FROM school_coordinators WHERE user_id = ?', user.id)
    const school = coord ? get('SELECT * FROM schools WHERE id = ?', coord.school_id) : null
    return {
      ...base,
      profile: {
        user_id: coord?.user_id ?? null,
        school_id: school?.id ?? coord?.school_id ?? null,
        school_name: school?.name ?? '',
        position: coord?.position ?? ''
      }
    }
  }
  return base
}

export function findOrCreateSchool(name) {
  const clean = String(name || '').trim()
  if (!clean) return null
  let school = get('SELECT * FROM schools WHERE lower(name) = lower(?)', clean)
  if (!school) {
    const id = runInsertSchool(clean)
    school = { id, name: clean }
  }
  return school
}

function runInsertSchool(name) {
  const stmt = db.prepare('INSERT INTO schools (name) VALUES (?)')
  const r = stmt.run(name)
  return Number(r.lastInsertRowid)
}

export function getSchoolById(id) {
  return get('SELECT * FROM schools WHERE id = ?', id)
}

export function getApplicantApplicationForPosting(applicantId, postingId) {
  return get(
    'SELECT * FROM applications WHERE applicant_id = ? AND posting_id = ? ORDER BY id DESC LIMIT 1',
    applicantId,
    postingId
  )
}