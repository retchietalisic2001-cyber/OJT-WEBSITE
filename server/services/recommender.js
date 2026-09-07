import { all } from '../db.js'
import { haversineKm } from './geo.js'

export function recommendPostings(profile, limit = 6) {
  const postings = all(`
    SELECT p.*, c.company_name, c.industry, c.lat AS company_lat, c.lng AS company_lng
    FROM postings p
    JOIN company_profiles c ON c.user_id = p.company_id
    WHERE p.status = 'open'
  `)

  const course = (profile?.course || '').trim()
  const lat = profile?.search_lat ?? null
  const lng = profile?.search_lng ?? null
  const createdCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000

  const scored = postings
    .map((p) => {
      const tags = String(p.course_tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const reasons = []
      let score = 0

      const courseMatch = course && tags.includes(course)
      if (courseMatch) {
        score += 40
        reasons.push('Matches your course')
      } else if (tags.length) {
        score += 8
        reasons.push('Open to related fields')
      }

      const dist = p.lat != null && lat != null && lng != null ? haversineKm(lat, lng, p.lat, p.lng) : null
      if (dist != null) {
        if (dist <= 10) {
          score += 30
          reasons.push(`Nearby (${dist.toFixed(1)} km)`)
        } else if (dist <= 30) {
          score += 20
          reasons.push(`Within range (${dist.toFixed(1)} km)`)
        } else {
          score += 5
          reasons.push(`${dist.toFixed(1)} km away`)
        }
      }

      const openSlots = (p.slots || 0) - p.filled
      if (p.slots > 0 && openSlots > 0) score += 12
      if (p.slots >= 3) score += 6

      if (p.industry) score += 4

      const created = new Date((p.created_at || '').replace(' ', 'T'))
      if (created.getTime() > createdCutoff) score += 6

      return { ...p, match_score: score, match_reasons: reasons, distance_km: dist, open_slots: Math.max(0, openSlots) }
    })
    .sort((a, b) => b.match_score - a.match_score || String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit)

  return scored
}