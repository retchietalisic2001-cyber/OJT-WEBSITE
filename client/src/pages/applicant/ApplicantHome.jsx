import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api } from '../../api.js'
import { Spinner, JobCard, emptyState } from '../../components/ui.jsx'
import { toast } from '../../toast.jsx'
import MapView from '../../components/MapView.jsx'

export default function ApplicantHome() {
  const { token, user } = useAuth()
  const [recs, setRecs] = useState(null)
  const [placement, setPlacement] = useState(null)
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoResult, setAutoResult] = useState(null)
  const [invites, setInvites] = useState([])
  const [inviteBusy, setInviteBusy] = useState(null)

  const load = () => {
    api('/recommendations', { token })
      .then(setRecs)
      .catch(() => setRecs([]))
  }

  const loadInvites = () => {
    api('/schools/enrollments/invites', { token })
      .then((r) => setInvites(r.invites || []))
      .catch(() => setInvites([]))
  }

  useEffect(() => {
    load()
    api('/schools/my-placement', { token })
      .then(setPlacement)
      .catch(() => setPlacement(null))
    loadInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const answerInvite = async (inv, action) => {
    setInviteBusy(inv.id)
    try {
      const r = await api(`/schools/enrollments/invites/${inv.id}/${action}`, { method: 'POST', token })
      toast.success(r.message)
      setInvites((list) => list.filter((i) => i.id !== inv.id))
      api('/schools/my-placement', { token }).then(setPlacement).catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      setInviteBusy(null)
    }
  }

  if (!recs) return <Spinner />

  const autoApply = async () => {
    setAutoBusy(true)
    setAutoResult(null)
    try {
      const r = await api('/recommendations/auto-apply', { method: 'POST', token, body: { count: 3 } })
      setAutoResult(r)
      if (r.applied.length) {
        toast.success(`AI sent ${r.applied.length} application${r.applied.length !== 1 ? 's' : ''} for you`)
      } else {
        toast.info(r.skipped.length ? 'You already applied to the top matches' : 'No new matches to auto-apply')
      }
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setAutoBusy(false)
    }
  }

  const aiApplyOne = async (r) => {
    try {
      await api('/applications', { method: 'POST', token, body: { posting_id: r.id, ai_cover: true } })
      toast.success(`AI applied to "${r.title}"`)
      setAutoResult({ applied: [r.id], skipped: [], failed: [] })
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const p = user?.profile || {}
  const center = p.search_lat != null ? [p.search_lat, p.search_lng] : null
  const radiusKm = p.search_radius != null ? Number(p.search_radius) : 25
  const hasRecs = recs.length > 0

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Hey, {user.name.split(' ')[0]} 👋</h1>
          <p className="muted">
            {p.course ? `${p.course} · ${p.year_level || ''}` : 'Profile incomplete — set your course below'}{' '}
            {p.search_city ? `· searching around ${p.search_city}` : ''}
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn btn-ghost" to="/app/profile">Edit profile</Link>
          <Link className="btn btn-primary" to="/app/browse">Browse all jobs</Link>
        </div>
      </header>

      {!recs.length && !p.course && (
        <div className="card card-pad">
          {emptyState(
            'Help us find your OJT',
            'Let us know your course and preferred area so we can recommend companies that fit you.',
            <Link className="btn btn-primary" to="/app/profile">Complete my profile</Link>
          )}
        </div>
      )}

      {placement?.enrollment && (
        <div className="card card-pad placement-banner">
          <div className="placement-inline">
            <div className="school-logo">
              {placement.enrollment.logo ? <img src={placement.enrollment.logo} alt={placement.enrollment.school_name} /> : '🏫'}
            </div>
            <div className="grow">
              <h3>🎓 Placed by your school</h3>
              <p className="muted">
                {placement.enrollment.school_name} · <strong>{placement.enrollment.course_name || 'Unassigned'}</strong>
                {placement.enrollment.room_name ? ` → 🚪 ${placement.enrollment.room_name}` : ''}
                <span className="muted small"> · Student ID 🪪 {placement.student_id || placement.enrollment.student_id}</span>
              </p>
            </div>
            <Link className="btn btn-ghost" to="/app/messages">💬 Message my school</Link>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <section className="invite-section">
          {invites.map((inv) => (
            <div className="card card-pad invite-banner" key={inv.id}>
              <div className="placement-inline">
                <div className="school-logo">
                  {inv.logo ? <img src={inv.logo} alt={inv.school_name} /> : '🏫'}
                </div>
                <div className="grow">
                  <h3>🎓 {inv.school_name} invited you</h3>
                  <p className="muted">
                    Your school wants to track your OJT progress. Accept to link your account{' '}
                    {placement?.student_id ? `(Student ID 🪪 ${placement.student_id})` : ''} — they'll assign you a course and room after.
                  </p>
                </div>
                <div className="invite-actions">
                  <button className="btn btn-primary" disabled={inviteBusy === inv.id} onClick={() => answerInvite(inv, 'accept')}>
                    {inviteBusy === inv.id ? 'Saving…' : '✅ Accept'}
                  </button>
                  <button className="btn btn-ghost" disabled={inviteBusy === inv.id} onClick={() => answerInvite(inv, 'decline')}>Decline</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {hasRecs ? (
        <section>
          <div className="section-head">
            <div>
              <h2>✨ AI suggestions for you</h2>
              <span className="muted">Best matches for your course, area &amp; resume — ranked by an AI matcher</span>
            </div>
            <button className="btn btn-primary" onClick={autoApply} disabled={autoBusy}>
              {autoBusy ? 'Auto-applying…' : '✨ Auto-apply to top matches'}
            </button>
          </div>

          {autoResult && (
            <div className="card card-pad auto-result">
              {autoResult.applied.length ? (
                <strong>✅ AI sent {autoResult.applied.length} application{autoResult.applied.length !== 1 ? 's' : ''}. </strong>
              ) : (
                <span />
              )}
              {autoResult.skipped.length ? `⏭️ Skipped ${autoResult.skipped.length} you already applied to. ` : ''}
              {!autoResult.applied.length && !autoResult.skipped.length ? 'No new matches found to auto-apply.' : ''}
            </div>
          )}

          <div className="rec-grid">
            <div className="rec-cards">
              {recs.map((r) => (
                <div key={r.id} className="job-card static">
                  <div className="job-card-top">
                    <div className="job-logo">{r.company_name?.charAt(0).toUpperCase()}</div>
                    <div className="job-title-wrap">
                      <h3>{r.title}</h3>
                      <span className="muted">{r.company_name}{r.city ? ` — ${r.city}` : ''}</span>
                    </div>
                    <div className="ai-match">
                      <strong>{r.match_percent}%</strong>
                      <span>AI match</span>
                    </div>
                    {r.distance_km != null && <span className="dist-chip">{r.distance_km.toFixed(1)} km</span>}
                  </div>
                  <p className="ai-reason">✨ {r.ai_reason}</p>
                  <p className="job-desc">{r.description}</p>
                  <div className="match-chips">
                    {r.match_reasons.map((reason) => (
                      <span key={reason} className="match-chip">✓ {reason}</span>
                    ))}
                  </div>
                  {r.matched_skills?.length ? (
                    <div className="skill-chips-tiny">
                      <span className="muted small">Matches your resume:</span>{' '}
                      {r.matched_skills.map((s) => <span key={s} className="skill-chip-tiny">{s}</span>)}
                    </div>
                  ) : null}
                  <div className="job-card-foot rec-foot">
                    <span className="muted">{r.open_slots} open slot{r.open_slots !== 1 ? 's' : ''}</span>
                    <div className="rec-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => aiApplyOne(r)}>✨ AI Apply</button>
                      <Link className="btn btn-ghost btn-sm" to={`/app/postings/${r.id}`}>View →</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rec-map card">
              <MapView
                markers={recs.filter((r) => r.lat != null).map((r) => ({
                  id: r.id,
                  lat: r.lat,
                  lng: r.lng,
                  title: r.title,
                  company_name: r.company_name,
                  color: '#5B4BDB'
                }))}
                center={center || [14.5995, 120.9842]}
                radiusKm={center ? radiusKm : null}
                height="100%"
              />
              <div className="rec-map-note">
                <Link to="/app/browse">Open full map search →</Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="card card-pad">
          {emptyState(
            'No matches yet',
            'Try browsing all roles or adjusting your profile and area.',
            <Link className="btn btn-primary" to="/app/browse">Start browsing</Link>
          )}
        </div>
      )}
    </div>
  )
}