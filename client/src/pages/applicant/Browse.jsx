import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../store.jsx'
import { api } from '../../api.js'
import { Spinner, JobCard, emptyState, StatusBadge } from '../../components/ui.jsx'
import MapView from '../../components/MapView.jsx'
import { COURSES, CITIES, CITY_COORDS } from '../../constants.js'

export default function Browse() {
  const { token, user } = useAuth()
  const p = user?.profile || {}

  const [course, setCourse] = useState(p.course || '')
  const [city, setCity] = useState(p.search_city || '')
  const [q, setQ] = useState('')
  const [radius, setRadius] = useState(25)
  const [pos, setPos] = useState(
    p.search_lat != null ? { lat: p.search_lat, lng: p.search_lng } : null
  )
  const [geoFail, setGeoFail] = useState(false)
  const [postings, setPostings] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchPostings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchPostings = async (overrides = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const c = overrides.course ?? course
      if (c) params.set('course', c)
      if (overrides.q ?? q) params.set('q', overrides.q ?? q)
      let lat = pos?.lat
      let lng = pos?.lng
      if (!lat && city && CITY_COORDS[city]) {
        lat = CITY_COORDS[city][0]
        lng = CITY_COORDS[city][1]
      }
      if (lat != null && lng != null) {
        params.set('lat', lat)
        params.set('lng', lng)
        params.set('radius', overrides.radius ?? radius)
      }
      params.set('withApplied', '1')
      const rows = await api(`/postings?${params}`, { token })
      setPostings(rows)
      setLoading(false)
    } catch (e) {
      setLoading(false)
      setPostings([])
    }
  }

  const useMyLocation = () => {
    setGeoFail(false)
    if (!navigator.geolocation) {
      setGeoFail(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (g) => {
        setPos({ lat: g.coords.latitude, lng: g.coords.longitude })
        setCity('')
      },
      () => setGeoFail(true)
    )
  }

  const markerList = useMemo(
    () =>
      (postings || []).filter((p) => p.lat != null).map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        title: p.title,
        company_name: p.company_name,
        distance_km: p.distance_km,
        color: p.applied_status ? '#2FA86B' : '#5B4BDB'
      })),
    [postings]
  )

  const mapCenter = pos ? [pos.lat, pos.lng] : city && CITY_COORDS[city] ? CITY_COORDS[city] : undefined

  if (!postings) return <Spinner />

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Browse OJT openings</h1>
          <p className="muted">Find companies accepting interns near you. The map shows where each opening is.</p>
        </div>
      </header>

      <div className="card filter-card">
        <div className="filters">
          <label className="field">
            <span className="field-label">Course</span>
            <select className="input" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Any course</option>
              {COURSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">City</span>
            <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Anywhere</option>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Keyword</span>
            <input className="input" placeholder="intern, helpdesk, engineer…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="field radius-field">
            <span className="field-label">
              Search radius <strong>{radius} km</strong>
            </span>
            <input type="range" min="1" max="100" value={radius} onChange={(e) => setRadius(+e.target.value)} className="range" />
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={() => fetchPostings()}>
              {loading ? 'Searching…' : 'Search'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={useMyLocation}>
              📍 Use my location
            </button>
          </div>
        </div>
        {geoFail && <p className="muted warn-text">Location unavailable — searching from selected city center instead.</p>}
        {city && !pos && <p className="muted">Selecting location from city center: {city}</p>}
      </div>

      <div className="browse-grid">
        <div className="jobs-col">
          <div className="results-count muted">
            {postings.length} opening{postings.length !== 1 ? 's' : ''}
          </div>
          {postings.length === 0 ? (
            <div className="card card-pad">
              {emptyState('No openings match', 'Try widening the radius, removing filters, or using your location.')}
            </div>
          ) : (
            postings.map((p) => (
              <JobCard
                key={p.id}
                p={p}
                to={`/app/postings/${p.id}`}
                extra={
                  p.applied_status ? (
                    <div className="applied-inline">
                      <StatusBadge status={p.applied_status} />
                      <span className="muted">You applied</span>
                    </div>
                  ) : (
                    <div className="applied-inline"><span className="open-chip">Open for applicants</span></div>
                  )
                }
              />
            ))
          )}
        </div>
        <div className="map-col">
          <MapView
            markers={markerList}
            center={mapCenter}
            radiusKm={mapCenter ? radius : null}
            height="100%"
            onSelect={(m) => {
              window.location.href = `/app/postings/${m.id}`
            }}
          />
        </div>
      </div>
    </div>
  )
}