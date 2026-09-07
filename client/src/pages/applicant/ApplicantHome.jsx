import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api } from '../../api.js'
import { Spinner, JobCard, emptyState } from '../../components/ui.jsx'
import MapView from '../../components/MapView.jsx'

export default function ApplicantHome() {
  const { token, user } = useAuth()
  const [recs, setRecs] = useState(null)

  useEffect(() => {
    api('/recommendations', { token })
      .then(setRecs)
      .catch(() => setRecs([]))
  }, [token])

  if (!recs) return <Spinner />

  const p = user?.profile || {}
  const center = p.search_lat != null ? [p.search_lat, p.search_lng] : null
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

      {hasRecs ? (
        <section>
          <div className="section-head">
            <h2>✨ Recommended for you</h2>
            <span className="muted">Matched to your course and area</span>
          </div>

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
                    {r.distance_km != null && <span className="dist-chip">{r.distance_km.toFixed(1)} km</span>}
                  </div>
                  <p className="job-desc">{r.description}</p>
                  <div className="match-chips">
                    {r.match_reasons.map((reason) => (
                      <span key={reason} className="match-chip">✓ {reason}</span>
                    ))}
                  </div>
                  <div className="job-card-foot rec-foot">
                    <span className="muted">{r.open_slots} open slot{r.open_slots !== 1 ? 's' : ''}</span>
                    <Link className="btn btn-ghost btn-sm" to={`/app/postings/${r.id}`}>View →</Link>
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
                radiusKm={null}
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