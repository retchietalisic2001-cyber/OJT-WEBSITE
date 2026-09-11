import { all, get } from '../db.js'
import { haversineKm } from './geo.js'

function extractSkills(rows) {
  return (rows || []).map((s) => String(s || '').trim().toLowerCase()).filter(Boolean)
}

async function loadResumeSkills(applicantId) {
  try {
    const row = await get('SELECT data FROM resumes WHERE applicant_id = ?', applicantId)
    if (!row?.data) return []
    const data = JSON.parse(row.data)
    return extractSkills(data.skills)
  } catch {
    return []
  }
}

function skillOverlap(skills, text) {
  const t = String(text || '').toLowerCase()
  const matched = (skills || []).filter((s) => s.length > 2 && t.includes(s))
  return matched
}

function matchPercent(parts) {
  const total = parts.reduce((sum, p) => sum + p.points, 10)
  const max = 105
  return Math.min(100, Math.max(5, Math.round((total / max) * 100)))
}

function reasonFor(parts, posting, profile, dist, openSlots, skills, matchedSkills) {
  const lines = []
  if (profile.course && posting.course_tags?.includes(profile.course)) {
    lines.push(`Closely matches your ${profile.course} course`)
  }
  if (dist != null) {
    lines.push(dist <= 10 ? `Only ${dist.toFixed(1)} km from your area — nearby` : `${dist.toFixed(1)} km from your area`)
  }
  if (matchedSkills.length) {
    lines.push(`Matches ${matchedSkills.length} skill${matchedSkills.length !== 1 ? 's' : ''} from your resume (${matchedSkills.slice(0, 3).join(', ')})`)
  }
  if (openSlots > 0) lines.push(`Has ${openSlots} open slot${openSlots !== 1 ? 's' : ''} ready`)
  if (!lines.length) lines.push('Open and related to your field')
  return lines
}

export async function recommendPostings(profile, limit = 6) {
  const postings = await all(`
    SELECT p.*, c.company_name, c.industry, c.logo AS company_logo, c.lat AS company_lat, c.lng AS company_lng,
           (SELECT COUNT(*) FROM applications a WHERE a.posting_id = p.id AND a.status = 'accepted') AS accepted_count
    FROM postings p
    JOIN company_profiles c ON c.user_id = p.company_id
    WHERE p.status = 'open'
  `)

  const course = (profile?.course || '').trim()
  const lat = profile?.search_lat ?? null
  const lng = profile?.search_lng ?? null
  const radiusKm = profile?.search_radius != null ? Number(profile.search_radius) : 25
  const createdCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const resumeSkills = await loadResumeSkills(profile?.user_id)

  const applied = new Set(
    (await all(`SELECT posting_id FROM applications WHERE applicant_id = ? AND status NOT IN ('rejected','withdrawn')`, profile?.user_id)).map((r) => r.posting_id)
  )

  const scored = postings
    .filter((p) => !applied.has(p.id))
    .map((p) => {
      const tags = String(p.course_tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const dist = p.lat != null && lat != null && lng != null ? haversineKm(lat, lng, p.lat, p.lng) : null
      const acceptedCount = p.accepted_count ?? 0
      const openSlots = (p.slots || 0) - acceptedCount
      const haystack = `${p.title || ''} ${p.description || ''} ${p.requirements || ''}`

      const parts = []
      const courseMatch = course && tags.includes(course)
      if (courseMatch) {
        parts.push({ points: 35, label: 'course' })
      } else if (tags.length) {
        parts.push({ points: 8, label: 'related' })
      }
      if (dist != null && radiusKm > 0) {
        const closeness = Math.max(0, 25 * (1 - dist / radiusKm))
        parts.push({ points: closeness, label: 'distance' })
      }
      const matchedSkills = skillOverlap(resumeSkills, haystack)
      parts.push({ points: Math.min(20, matchedSkills.length * 2.5), label: 'skills' })
      if (openSlots > 0) parts.push({ points: 10, label: 'slots' })
      const created = new Date((p.created_at || '').replace(' ', 'T'))
      const ageDays = (Date.now() - created.getTime()) / (24 * 60 * 60 * 1000)
      if (created.getTime() && ageDays < 7) parts.push({ points: 5, label: 'fresh' })
      else if (created.getTime() > createdCutoff) parts.push({ points: 2, label: 'fresh' })
      if (p.industry || p.description) parts.push({ points: 2, label: 'complete' })

      const reasons = reasonFor(parts, p, profile, dist, openSlots, resumeSkills, matchedSkills)
      const missingSkills = (resumeSkills || []).filter((s) => !matchedSkills.includes(s)).slice(0, 3)

      return {
        ...p,
        match_percent: matchPercent(parts),
        match_score: parts.reduce((sum, part) => sum + part.points, 0),
        match_reasons: reasons,
        ai_reason: reasons[0] || 'Related opening in your field',
        matched_skills: matchedSkills.slice(0, 5),
        skills_to_gain: missingSkills,
        distance_km: dist,
        open_slots: Math.max(0, openSlots)
      }
    })
    .filter((p) => (lat == null || p.distance_km == null || p.distance_km <= radiusKm))
    .sort((a, b) => b.match_score - a.match_score || String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit)

  return scored
}

export function generateCover({ applicantName, course, yearLevel, posting }) {
  const company = posting?.company_name || 'your company'
  const line1 = `Hello ${company},`
  const side = course ? `${course}${yearLevel ? ` (${yearLevel.replace(' Year', '')} year)` : ''}` : 'student'
  const body = `I'm ${applicantName}, a ${side} looking for my OJT internship. The ${posting?.title || 'open position'} fits my skills and I'm ready to learn and contribute.`
  return `${line1}\n${body}\n\nI found this opening through OJT Connect's AI match for my course and area. Thank you for considering my application!`
}