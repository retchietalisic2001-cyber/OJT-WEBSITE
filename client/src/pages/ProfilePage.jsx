import { useEffect, useState } from 'react'
import { useAuth } from '../store.jsx'
import { useConfirm } from '../confirm.jsx'
import { api } from '../api.js'
import { Spinner } from '../components/ui.jsx'
import LocationPicker from '../components/LocationPicker.jsx'
import VerificationPanel from '../components/VerificationPanel.jsx'
import { toast } from '../toast.jsx'
import { COURSES, YEAR_LEVELS, CITIES, CITY_COORDS } from '../constants.js'

export default function ProfilePage() {
  const { token, user, setProfile } = useAuth()
  const confirm = useConfirm()
  const [schools, setSchools] = useState([])
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const p = (user && user.profile) || {}
  const role = user?.role || ''

  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    phone: user?.phone || '',
    birthdate: user?.birthdate || '',
    gender: user?.gender || '',
    course: p.course || '',
    yearLevel: p.year_level || '',
    studentId: p.student_id || '',
    searchCity: p.search_city || '',
    schoolId: p.school_id || '',
    schoolName: '',
    courseMode: p.course && !COURSES.includes(p.course) ? 'other' : 'pick',
    companyName: p.company_name || '',
    industry: p.industry || '',
    description: p.description || '',
    address: user?.role === 'company' ? (p.address || '') : (user?.address || ''),
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
      username: user.username || '',
      phone: user.phone || u.phone || '',
      birthdate: user.birthdate || '',
      gender: user.gender || '',
      course: u.course || '',
      yearLevel: u.year_level || '',
      studentId: u.student_id || '',
      searchCity: u.search_city || '',
      schoolId: u.school_id || '',
      companyName: u.company_name || '',
      industry: u.industry || '',
      description: u.description || '',
      address: role === 'company' ? (u.address || '') : (user.address || ''),
      position: u.position || ''
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (!user) return <Spinner />

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    const ok = await confirm({
      title: 'Save profile changes?',
      message: 'Your updated details will be shown to companies, schools, and admins.',
      confirmLabel: 'Save changes',
      danger: false
    })
    if (!ok) return
    try {
      const updated = await api('/auth/profile', { method: 'PUT', token, body: form })
      setProfile(updated)
      toast.success('Profile updated')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.type)) {
      return toast.error('Please choose an image (PNG, JPG, WebP or GIF)')
    }
    if (file.size > 5 * 1024 * 1024) return toast.error('Image is too large — maximum 5MB')
    const fd = new FormData()
    fd.append('avatar', file)
    setAvatarBusy(true)
    try {
      const updated = await api('/auth/avatar', { method: 'PUT', token, form: fd })
      setProfile(updated)
      toast.success('Profile picture updated')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAvatarBusy(false)
    }
  }

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.type)) {
      return toast.error('Please choose an image (PNG, JPG, WebP or GIF)')
    }
    if (file.size > 5 * 1024 * 1024) return toast.error('Image is too large — maximum 5MB')
    const fd = new FormData()
    fd.append('logo', file)
    setLogoBusy(true)
    try {
      const updated = await api('/auth/logo', { method: 'PUT', token, form: fd })
      setProfile(updated)
      toast.success(role === 'company' ? 'Company logo updated' : 'School logo updated')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLogoBusy(false)
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
        <div className="avatar-picker">
          <div className="avatar lg">
            {user.avatar ? <img src={user.avatar} alt={user.name} /> : (role === 'company' ? (p.company_name || user.name).charAt(0).toUpperCase() : user.name.charAt(0).toUpperCase())}
          </div>
          <div className="avatar-picker-actions">
            <label className="btn btn-ghost btn-sm avatar-upload-btn">
              {avatarBusy ? 'Uploading…' : '📷 Upload profile picture'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadAvatar} disabled={avatarBusy} hidden />
            </label>
            <span className="muted small">Shown on your profile and in the header. PNG, JPG or WebP, max 5MB.</span>
          </div>
        </div>

        {(role === 'company' || role === 'school') && (
          <div className="avatar-picker logo-row">
            <div className="logo-preview">
              {p.logo ? <img src={p.logo} alt={role === 'company' ? 'Company logo' : 'School logo'} /> : (role === 'company' ? (p.company_name || 'C').charAt(0).toUpperCase() : (p.school_name || 'S').charAt(0).toUpperCase())}
            </div>
            <div className="avatar-picker-actions">
              <label className="btn btn-ghost btn-sm avatar-upload-btn">
                {logoBusy ? 'Uploading…' : role === 'company' ? '🖼️ Upload company logo' : '🖼️ Upload school logo'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadLogo} disabled={logoBusy} hidden />
              </label>
              <span className="muted small">
                {role === 'company'
                  ? 'Used on your job postings so students recognize your company. PNG, JPG or WebP, max 5MB.'
                  : 'Used on your school pages for easy identification. PNG, JPG or WebP, max 5MB.'}
              </span>
            </div>
          </div>
        )}

        <h3>Account details</h3>
        <div className="form-grid">
          <label className="field">Username
            <input className="input" value={form.username} onChange={(e) => set('username', e.target.value)} />
          </label>
          <label className="field">Contact number
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
          <label className="field">Date of birth
            <input className="input" type="date" value={form.birthdate} onChange={(e) => set('birthdate', e.target.value)} />
          </label>
          <label className="field">Gender
            <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">— select —</option>
              {['Male', 'Female', 'Prefer not to say'].map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
        </div>

        {role === 'applicant' && (
          <>
            <h3>Basic info</h3>
            <div className="form-grid">
              <label className="field">Full name
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </label>
              <label className="field">Home address
                <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} />
              </label>
              <label className="field">Course
                 <div className="seg">
                   <button
                     type="button"
                     className={form.courseMode === 'pick' ? 'active' : ''}
                     onClick={() => set('courseMode', 'pick')}
                   >
                     Select course
                   </button>
                   <button
                     type="button"
                     className={form.courseMode === 'other' ? 'active' : ''}
                     onClick={() => set('courseMode', 'other')}
                   >
                     Not listed
                   </button>
                 </div>
                 {form.courseMode === 'pick'
                   ? (
                     <select className="input" value={form.course} onChange={(e) => set('course', e.target.value)}>
                       <option value="">— select —</option>
                       {COURSES.map((c) => <option key={c}>{c}</option>)}
                     </select>
                   )
                   : (
                     <input
                       className="input"
                       value={form.course}
                       onChange={(e) => set('course', e.target.value)}
                       placeholder="Type your course name"
                     />
                   )}
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
                <span className="muted small">Use the exact Student / School ID your school uses so they can place you in your course &amp; room.</span>
              </label>
              <label className="field">Student / School ID
                <input className="input" value={form.studentId} onChange={(e) => set('studentId', e.target.value)} placeholder="e.g. 2025-00123" />
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
            <div className="form-grid">
              <label className="field">Home address
                <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} />
              </label>
            </div>
          </>
        )}

        {(role === 'company' || role === 'school') && (
          <VerificationPanel role={role} />
        )}
      </div>
    </div>
  )
}