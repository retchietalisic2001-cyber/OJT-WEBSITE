import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, roleHome } from '../store.jsx'
import { api } from '../api.js'
import { toast } from '../toast.jsx'

const EYE_ON =
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>
const EYE_OFF =
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>

export default function ChangePassword() {
  const { token, user, setProfile } = useAuth()
  const navigate = useNavigate()
  const mustChange = !!user?.must_change_password

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) return toast.error('New password must be at least 6 characters')
    if (newPassword !== confirm) return toast.error('Passwords do not match')
    if (!mustChange && !currentPassword) return toast.error('Enter your current password')

    setBusy(true)
    try {
      const body = { newPassword }
      if (!mustChange) body.currentPassword = currentPassword
      const res = await api('/auth/password', { method: 'PUT', token, body })
      setProfile(res.user)
      toast.success(mustChange ? 'Password set — you can now continue' : 'Password updated')
      navigate(roleHome(user.role), { replace: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page auth-page-wrap">
      <div className="card card-pad auth-card" style={{ maxWidth: 460, margin: '40px auto' }}>
        <h1>{mustChange ? 'Set a new password' : 'Change password'}</h1>
        {mustChange ? (
          <p className="muted">
            Your account was created with a temporary password sent to your email. For security, please set your own
            password before continuing.
          </p>
        ) : (
          <p className="muted">Update the password you use to sign in to OJT Connect.</p>
        )}

        <form onSubmit={submit} className="auth-form">
          {!mustChange && (
            <label className="field">
              <span className="field-label">Current password</span>
              <div className="pwd-wrap">
                <input
                  className="input"
                  type={show.current ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" className="pwd-toggle" aria-label="Toggle password visibility" onClick={() => setShow((s) => ({ ...s, current: !s.current }))}>
                  {show.current ? EYE_ON : EYE_OFF}
                </button>
              </div>
            </label>
          )}
          <label className="field">
            <span className="field-label">New password</span>
            <div className="pwd-wrap">
              <input
                className="input"
                type={show.next ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                placeholder="Min 6 characters"
              />
              <button type="button" className="pwd-toggle" aria-label="Toggle password visibility" onClick={() => setShow((s) => ({ ...s, next: !s.next }))}>
                {show.next ? EYE_ON : EYE_OFF}
              </button>
            </div>
          </label>
          <label className="field">
            <span className="field-label">Confirm new password</span>
            <div className="pwd-wrap">
              <input
                className="input"
                type={show.confirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                placeholder="Repeat your new password"
              />
              <button type="button" className="pwd-toggle" aria-label="Toggle password visibility" onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}>
                {show.confirm ? EYE_ON : EYE_OFF}
              </button>
            </div>
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving…' : mustChange ? 'Set password & continue' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}