import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth, roleHome } from '../store.jsx'
import { api } from '../api.js'
import { toast } from '../toast.jsx'
import { COURSES, YEAR_LEVELS } from '../constants.js'

const ROLES = [
  { id: 'applicant', label: 'I am an Applicant', desc: 'Looking for my OJT', icon: 'resume' },
  { id: 'company', label: 'I represent a Company', desc: 'Post OJT openings', icon: 'doc' },
  { id: 'school', label: 'I work in a School', desc: 'Monitor my students', icon: 'home' }
]

export default function AuthPage() {
  const { user, ready, login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [schools, setSchools] = useState([])
  const [form, setForm] = useState({ role: 'applicant', schoolId: '', newSchool: '', schoolMode: 'pick' })

  useEffect(() => {
    api('/schools').then(setSchools).catch(() => {})
  }, [])

  if (ready && user) return <Navigate to={roleHome(user.role)} replace />

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    const payload = {
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
      position: form.position
    }
    try {
      if (form.role === 'applicant') {
        payload.course = form.course
        payload.yearLevel = form.yearLevel
        payload.phone = form.phone
        if (form.schoolMode === 'new') payload.schoolName = form.newSchool
        else payload.schoolId = form.schoolId
      }
      if (form.role === 'company') {
        payload.companyName = form.companyName
        payload.industry = form.industry
      }
      if (form.role === 'school') {
        payload.schoolName = form.schoolName
        payload.position = form.position
      }

      const u = mode === 'register' ? await register(payload) : await login(form.email, form.password)
      toast.success(mode === 'register' ? `Welcome to OJT Connect, ${u.name.split(' ')[0]}!` : 'Welcome back!')
      navigate(roleHome(u.role))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const input = (k, props = {}) => (
    <input
      className="input"
      value={form[k] || ''}
      onChange={(e) => set(k, e.target.value)}
      required
      {...props}
    />
  )
  const select = (k, options, props = {}) => (
    <select className="input" value={form[k] || ''} onChange={(e) => set(k, e.target.value)} required {...props}>
      <option value="">— select —</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-brand">
          <span className="brand-mark lg">
            <svg viewBox="0 0 100 100" width="40" height="40">
              <rect width="100" height="100" rx="22" fill="#fff" />
              <path d="M50 18c11 0 20 8 20 18.4C70 52 50 84 50 84S30 52 30 36.4C30 26 39 18 50 18Z" fill="#FF7A59" />
              <circle cx="50" cy="37" r="9" fill="#5B4BDB" />
            </svg>
          </span>
          <h2>
            OJT <em>Connect</em>
          </h2>
        </div>
        <h1>Find your OJT.<br />No more office hopping.</h1>
        <p>
          Browse OJT openings near you, apply with one click, send your documents in chat, and track every step —
          all in one place. Schools get live insight into which students have found companies.
        </p>
        <ul className="auth-points">
          <li>🗺️ Map search by your area &amp; course</li>
          <li>🤝 Direct chat with companies</li>
          <li>📎 Submit documents &amp; photos in chat</li>
          <li>📈 Live application tracking</li>
          <li>✨ AI-assisted resume builder</li>
        </ul>
        <div className="auth-credit">
          Demo accounts (password <code>demo123</code>): <b>company@demo.com</b> · <b>applicant@demo.com</b> · <b>school@demo.com</b>
        </div>
      </div>

      <div className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && (
              <>
                <div className="role-grid">
                  {ROLES.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      className={'role-card' + (form.role === r.id ? ' selected' : '')}
                      onClick={() => set('role', r.id)}
                    >
                      <strong>{r.label}</strong>
                      <span>{r.desc}</span>
                    </button>
                  ))}
                </div>

                {form.role === 'applicant' && (
                  <div className="form-grid">
                    <label className="field">Course
                      {select('course', COURSES)}
                    </label>
                    <label className="field">Year level
                      {select('yearLevel', YEAR_LEVELS)}
                    </label>
                  </div>
                )}

                {form.role === 'company' && (
                  <div className="form-grid">
                    <label className="field">Company name
                      {input('companyName', { placeholder: 'e.g. TechNova Solutions' })}
                    </label>
                    <label className="field">Industry
                      {input('industry', { placeholder: 'e.g. IT Services' })}
                    </label>
                  </div>
                )}

                {form.role === 'school' && (
                  <div className="form-grid">
                    <label className="field">School name
                      {input('schoolName', { placeholder: 'e.g. University of the East' })}
                    </label>
                    <label className="field">Your role
                      {input('position', { placeholder: 'e.g. OJT Coordinator', defaultValue: 'OJT Coordinator' })}
                    </label>
                  </div>
                )}
              </>
            )}

            <label className="field">Full name
              {mode === 'register' ? input('name', { placeholder: 'Your full name' }) : null}
            </label>
            <label className="field">Email
              {input('email', { type: 'email', placeholder: 'you@example.com' })}
            </label>
            <label className="field">Password
              {input('password', { type: 'password', placeholder: form.role === 'applicant' && mode === 'register' ? 'Min 6 characters' : '••••••••', minLength: 6 })}
            </label>

            {mode === 'register' && form.role === 'applicant' && (
              <div className="field">
                <label className="field-label">Your school</label>
                <div className="seg">
                  <button type="button" className={form.schoolMode === 'pick' ? 'active' : ''} onClick={() => set('schoolMode', 'pick')}>Select school</button>
                  <button type="button" className={form.schoolMode === 'new' ? 'active' : ''} onClick={() => set('schoolMode', 'new')}>Not listed</button>
                </div>
                {form.schoolMode === 'pick' ? (
                  <select className="input" value={form.schoolId} onChange={(e) => set('schoolId', e.target.value)} required>
                    <option value="">— select your school —</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input" placeholder="Type your school name" value={form.newSchool} onChange={(e) => set('newSchool', e.target.value)} required />
                )}
              </div>
            )}

            {form.role === 'applicant' && mode === 'register' && (
              <label className="field">Phone (optional)
                <input className="input" placeholder="09xx xxx xxxx" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
              </label>
            )}

            <button className="btn btn-primary btn-block" type="submit">
              {mode === 'login' ? 'Sign in' : 'Create my account'}
            </button>

            {mode === 'login' && (
              <button type="button" className="link-btn demo-btn" onClick={() => { setForm((f) => ({ ...f, email: 'applicant@demo.com', password: 'demo123' })) }}>
                Fill in demo applicant account
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}