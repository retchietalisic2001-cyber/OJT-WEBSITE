import { useEffect, useState } from 'react'
import { useAuth } from '../store.jsx'
import { api } from '../api.js'
import { Spinner } from '../components/ui.jsx'
import LocationPicker from '../components/LocationPicker.jsx'
import { toast } from '../toast.jsx'
import { COURSES, YEAR_LEVELS, CITIES, CITY_COORDS } from '../constants.js'

export default function ProfilePage() {
  const { token, user, setProfile } = useAuth()
  const [schools, setSchools] = useState([])
  const p = (user && user.profile) || {}
  const role = user?.role || ''

  const [form, setForm] = useState({
    name: user?.name || '',
    course: p.course || '',
    yearLevel: p.year_level || '',
    phone: p.phone || '',
    searchCity: p.search_city || '',
    schoolId: p.school_id || '',
    schoolName: '',
    companyName: p.company_name || '',
    industry: p.industry || '',
    description: p.description || '',
    address: p.address || '',
    position: p.position || ''
  })

  useEffect(() => {
    api('/schools').then(setSchools).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) return
    const u = user.profile || {}
    setForm({
      name: user.name,
      course: u.course || '',
      yearLevel: u.year_level || '',
      phone: u.phone || '',
      searchCity: u.search_city || '',
      schoolId: u.school_id || '',
      companyName: u.company_name || '',
      industry: u.industry || '',
      description: u.description || '',
      address: u.address || '',
      position: u.position || ''
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (!user) return <Spinner />

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    try {
      const updated = await api('/auth/profile', { method: 'PUT', token, body: form })
      setProfile(updated)
      toast.success('Profile updated')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition?.((g) => {
      const lat = +g.coords.latitude.toFixed(6)
      const lng = +g.coords.longitude.toFixed(6)
      if (role === 'applicant') {
        set('searchLat', lat)
        set('searchLng', lng)
        set('searchCity', '')
      } else {
        set('lat', lat)
        set('lng', lng)
      }
      toast.success('Location set from your device')
    }, () => toast.error('Location unavailable'))
  }

  const pickCity = (city) => {
    const c = CITY_COORDS[city]
    if (c) {
      set('searchLat', c[0])
      set('searchLng', c[1])
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>My Profile</h1>
          <p className="muted">Keep your details up to date — companies use this to review you.</p>
        </div>
        <button className="btn btn-primary" onClick={save}>Save changes</button>
      </header>

      <div className="card card-pad profile-form">
        {role === 'applicant' && (
          <>
            <h3>Basic info</h3>
            <div className="form-grid">
              <label className="field">Full name
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </label>
              <label className="field">Phone
                <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </label>
              <label className="field">Course
                <select className="input" value={form.course} onChange={(e) => set('course', e.target.value)}>
                  <option value="">— select —</option>
                  {COURSES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="field">Year level
                <select className="input" value={form.yearLevel} onChange={(e) => set('yearLevel', e.target.value)}>
                  <option value="">— select —</option>
                  {YEAR_LEVELS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </label>
            </div>

            <h3>School</h3>
            <div className="form-grid">
              <label className="field">School
                <select className="input" value={form.schoolId} onChange={(e) => set('schoolId', e.target.value)}>
                  <option value="">— select —</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>

            <h3>Search area</h3>
            <p className="muted small">Recommendations and search radius are centered around this area.</p>
            <div className="form-grid">
              <label className="field">Preferred city
                <select className="input" value={form.searchCity} onChange={(e) => { set('searchCity', e.target.value); pickCity(e.target.value) }}>
                  <option value="">Anywhere in Metro Manila</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <div className="field">
                <span className="field-label">&nbsp;</span>
                <button className="btn btn-ghost" onClick={useMyLocation}>📍 Use my location</button>
              </div>
            </div>
          </>
        )}

        {role === 'company' && (
          <>
            <h3>Company info</h3>
            <div className="form-grid">
              <label className="field">Company name
                <input className="input" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
              </label>
              <label className="field">Industry
                <input className="input" value={form.industry} onChange={(e) => set('industry', e.target.value)} />
              </label>
              <label className="field full">Description
                <textarea className="input textarea" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </label>
            </div>
            <h3>Head office location</h3>
            <div className="form-grid">
              <label className="field full">Address
                <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} />
              </label>
              <label className="field full">
                <span className="field-label">Pin on map</span>
                <LocationPicker
                  value={form.lat != null ? [Number(form.lat), Number(form.lng)] : undefined}
                  onChange={(c) => { set('lat', c.lat); set('lng', c.lng) }}
                />
              </label>
            </div>
          </>
        )}

        {role === 'school' && (
          <>
            <h3>School profile</h3>
            <div className="form-grid">
              <label className="field">School
                <select className="input" value={form.schoolId} onChange={(e) => set('schoolId', e.target.value)}>
                  <option value="">— select —</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="field">Your role
                <input className="input" value={form.position} onChange={(e) => set('position', e.target.value)} />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  )
}