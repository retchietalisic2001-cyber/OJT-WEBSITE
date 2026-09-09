import { get, run } from '../db.js'

export async function profileFor(user) {
  const base = { id: user.id, name: user.name, email: user.email, username: user.username || '', role: user.role, phone: user.phone || '', address: user.address || '', birthdate: user.birthdate || '', gender: user.gender || '', avatar: user.avatar || '' }
  if (user.role === 'applicant') {
    const p = await get('SELECT * FROM applicant_profiles WHERE user_id = ?', user.id)
    let school = null
    let schoolName = p?.school_name || ''
    if (p?.school_id) {
      school = await get('SELECT name FROM schools WHERE id = ?', p.school_id)
      schoolName = school?.name || schoolName
    }
    return { ...base, school_name: schoolName, profile: { ...p, school_name: schoolName } }
  }
  if (user.role === 'company') {
    const p = await get('SELECT * FROM company_profiles WHERE user_id = ?', user.id)
    return { ...base, profile: p }
  }
  if (user.role === 'school') {
    const coord = await get('SELECT * FROM school_coordinators WHERE user_id = ?', user.id)
    const school = coord ? await get('SELECT * FROM schools WHERE id = ?', coord.school_id) : null
    return {
      ...base,
      profile: {
        user_id: coord?.user_id ?? null,
        school_id: school?.id ?? coord?.school_id ?? null,
        school_name: school?.name ?? '',
        position: coord?.position ?? '',
        logo: school?.logo || ''
      }
    }
  }
  return base
}

export async function findOrCreateSchool(name) {
  const clean = String(name || '').trim()
  if (!clean) return null
  let school = await get('SELECT * FROM schools WHERE lower(name) = lower(?)', clean)
  if (!school) {
    const id = await run('INSERT INTO schools (name) VALUES (?)', clean)
    school = { id, name: clean }
  }
  return school
}

export async function getSchoolById(id) {
  return get('SELECT * FROM schools WHERE id = ?', id)
}

export async function getApplicantApplicationForPosting(applicantId, postingId) {
  return get(
    'SELECT * FROM applications WHERE applicant_id = ? AND posting_id = ? ORDER BY id DESC LIMIT 1',
    applicantId,
    postingId
  )
}