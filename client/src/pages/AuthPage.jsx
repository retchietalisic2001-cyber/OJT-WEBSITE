import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth, roleHome } from '../store.jsx'
import { api } from '../api.js'
import { toast } from '../toast.jsx'
import { COURSES, YEAR_LEVELS, PH_UNIVERSITIES } from '../constants.js'

const GENDERS = ['Male', 'Female', 'Prefer not to say']

const PH_MOBILE = /^(09\d{9}|\+?639\d{9})$/

function isValidPhMobile(value) {
  const digits = String(value || '').replace(/[\s\-]/g, '')
  return PH_MOBILE.test(digits)
}

const EYE_ON =
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>
const EYE_OFF =
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>

export default function AuthPage() {
  const { user, ready, login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [schools, setSchools] = useState([])
  const [form, setForm] = useState({ schoolId: '', schoolSel: '', newSchool: '', schoolMode: 'pick', courseMode: 'pick' })
  const [show, setShow] = useState({})
  const [socialError, setSocialError] = useState(() => new URLSearchParams(window.location.search).get('error') === 'social')

  useEffect(() => {
    api('/schools').then(setSchools).catch(() => {})
  }, [])

  const schoolOptions = (() => {
    const seen = new Set(schools.map((s) => s.name.toLowerCase()))
    return [
      ...schools.map((s) => ({ value: `db:${s.id}`, label: s.name })),
      ...PH_UNIVERSITIES.map((n) => ({ value: `new:${n}`, label: n })).filter((o) => !seen.has(o.label.toLowerCase()))
    ]
  })()

  if (ready && user) return <Navigate to={roleHome(user.role)} replace />

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (mode === 'register') {
      if (form.password !== form.confirmPassword) {
        toast.error('Passwords do not match')
        return
      }
      if (!isValidPhMobile(form.phone)) {
        toast.error('Enter a valid Philippine mobile number (e.g. 0917 123 4567)')
        return
      }
    }
    const payload = {
      name: form.name,
      email: form.email,
      username: form.username,
      password: form.password,
      role: 'applicant',
      phone: form.phone,
      address: form.address,
      birthdate: form.birthdate,
      gender: form.gender,
      course: form.course,
      yearLevel: form.yearLevel,
      studentId: form.studentId
    }
    try {
      if (form.schoolMode === 'new') {
        payload.schoolName = form.newSchool
      } else {
        const sel = String(form.schoolSel || '')
        if (sel.startsWith('db:')) payload.schoolId = sel.slice(3)
        else if (sel.startsWith('new:')) payload.schoolName = sel.slice(4)
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
  const pwd = (k, props = {}) => (
    <div className="pwd-wrap">
      <input
        className="input"
        type={show[k] ? 'text' : 'password'}
        value={form[k] || ''}
        onChange={(e) => set(k, e.target.value)}
        required
        {...props}
      />
      <button type="button" className="pwd-toggle" aria-label="Toggle password visibility" onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}>
        {show[k] ? EYE_OFF : EYE_ON}
      </button>
    </div>
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
      </div>

      <div className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
          </div>

          {socialError && (
            <div className="social-error-banner">Sign-in with Google or Facebook failed. Please try again.</div>
          )}

          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && (
              <>
                <div className="field">
                  <label className="field-label">Signing up as an <strong>Applicant</strong></label>
                  <p className="muted small">Companies and schools are verified and added by an administrator — this prevents fake accounts and scam OJT offers.</p>
                </div>

                <div className="form-grid">
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
                      ? select('course', COURSES)
                      : input('course', { placeholder: 'Type your course name' })}
                  </label>
                  <label className="field">Year level
                    {select('yearLevel', YEAR_LEVELS.filter((y) => y === '3rd Year' || y === '4th Year'))}
                  </label>
                </div>
              </>
            )}

            <div className="form-grid">
              <label className="field">Full name
                {mode === 'register' ? input('name', { placeholder: 'Your full name' }) : null}
              </label>
              {mode === 'register' && (
                <label className="field">Student number / username
                  {input('username', { placeholder: 'e.g. 2021-01234' })}
                </label>
              )}
            </div>

            <label className="field">Email or username
              {input('email', { type: mode === 'register' ? 'email' : 'text', placeholder: mode === 'register' ? 'you@example.com' : 'you@example.com or your username' })}
            </label>

            {mode === 'register' && (
              <>
                <div className="form-grid">
                  <label className="field">Contact number
                    {input('phone', { type: 'tel', placeholder: '0917 xxx xxxx (Philippine mobile)', pattern: '^(09\\d{9}|\\+?639\\d{9})$', title: 'Enter a valid Philippine mobile number, e.g. 0917 123 4567' })}
                  </label>
                  <label className="field">Date of birth
                    {input('birthdate', { type: 'date' })}
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">Gender
                    {select('gender', GENDERS)}
                  </label>
                  <label className="field">Home address
                    {input('address', { placeholder: 'Street, Barangay, City', required: false })}
                  </label>
                </div>
              </>
            )}

            <label className="field">Password
              {pwd('password', { placeholder: mode === 'register' ? 'Min 6 characters' : '••••••••', minLength: 6 })}
            </label>
            {mode === 'register' && (
              <label className="field">Confirm password
                {pwd('confirmPassword', { placeholder: 'Repeat your password', minLength: 6 })}
              </label>
            )}

            {mode === 'register' && (
              <div className="field">
                <label className="field-label">Your school</label>
                <div className="seg">
                  <button type="button" className={form.schoolMode === 'pick' ? 'active' : ''} onClick={() => set('schoolMode', 'pick')}>Select school</button>
                  <button type="button" className={form.schoolMode === 'new' ? 'active' : ''} onClick={() => set('schoolMode', 'new')}>Not listed</button>
                </div>
                {form.schoolMode === 'pick' ? (
                  <select className="input" value={form.schoolSel} onChange={(e) => set('schoolSel', e.target.value)} required>
                    <option value="">— select your school or university —</option>
                    {schoolOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input" placeholder="Type your school name" value={form.newSchool} onChange={(e) => set('newSchool', e.target.value)} required />
                )}
              </div>
            )}

            {mode === 'register' && (
              <label className="field">
                <span className="field-label">Student / School ID <em className="muted">(optional — your school can place you into your course &amp; room by this ID)</em></span>
                <input className="input" placeholder="e.g. 2025-00123" value={form.studentId || ''} onChange={(e) => set('studentId', e.target.value)} />
              </label>
            )}

            <button className="btn btn-primary btn-block" type="submit">
              {mode === 'login' ? 'Sign in' : 'Create my account'}
            </button>

            {mode === 'login' && (
              <>
                <div className="divider-label">or continue with</div>
                <div className="social-row">
                  <a className="social-btn social-google" href="/api/auth/google">
                    <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.46H12v4.66h6.46a5.6 5.6 0 0 1-2.43 3.67v3.05h3.94c2.3-2.12 3.53-5.24 3.53-8.92z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.9l-3.94-3.05c-1.1.74-2.5 1.18-4 1.18-3.07 0-5.67-2.08-6.6-4.86H1.3v3.15A11.99 11.99 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.37a7.2 7.2 0 0 1 0-4.74V6.48H1.3a12 12 0 0 0 0 11.04l4.1-3.15z"/><path fill="#EA4335" d="M12 4.67c1.76 0 3.35.61 4.6 1.8l3.43-3.44C17.96 1.08 15.24 0 12 0A11.99 11.99 0 0 0 1.3 6.48l4.1 3.15C6.33 6.75 8.93 4.67 12 4.67z"/></svg>
                    Google
                  </a>
                  <a className="social-btn social-facebook" href="/api/auth/facebook">
                    <svg viewBox="0 0 24 24"><path fill="#fff" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.02 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.87v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.09 24 12.07z"/></svg>
                    Facebook
                  </a>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}