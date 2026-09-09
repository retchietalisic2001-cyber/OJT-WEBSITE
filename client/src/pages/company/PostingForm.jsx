import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { useConfirm } from '../../confirm.jsx'
import { api } from '../../api.js'
import { Spinner } from '../../components/ui.jsx'
import LocationPicker from '../../components/LocationPicker.jsx'
import { toast } from '../../toast.jsx'
import { COURSES, CITIES, CITY_COORDS } from '../../constants.js'

const DRAFT_KEY = 'ojt_posting_draft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveDraft(form) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: form, savedAt: Date.now() })) } catch {}
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch {}
}

export default function PostingForm() {
  const { id } = useParams()
  const isEdit = !!id
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [loadingEdit, setLoadingEdit] = useState(isEdit)
  const [verify, setVerify] = useState(null)
  const [draftAvailable, setDraftAvailable] = useState(false)
  const loadedRef = useRef(false)
  const co = user?.profile || {}

  const [form, setForm] = useState({
    title: '',
    description: '',
    requirements: '',
    course_tags: [],
    slots: 1,
    city: '',
    address: '',
    lat: null,
    lng: null
  })

  useEffect(() => {
    const draft = loadDraft()
    if (draft?.data) {
      const d = draft.data
      const hasRealContent = !!(d.title?.trim() || d.description?.trim() || d.requirements?.trim() || d.city?.trim() || d.address?.trim() || (d.course_tags && d.course_tags.length))
      if (hasRealContent && draft.savedAt && draft.savedAt < Date.now() - 5000) {
        setDraftAvailable(true)
      }
    }
  }, [])

  const matchCity = (addr) => {
    const a = String(addr || '').toLowerCase()
    return CITIES.find((c) => a.includes(c.toLowerCase())) || ''
  }

  const applyCompanyLocation = (silent = false) => {
    if (co.lat == null || co.lng == null) return false
    setForm((f) => ({
      ...f,
      lat: Number(co.lat),
      lng: Number(co.lng),
      address: f.address || co.address || '',
      city: f.city || matchCity(co.address)
    }))
    if (!silent) toast.success('Location set to your company office')
    return true
  }

  useEffect(() => {
    if (!isEdit) {
      if (!applyCompanyLocation(true)) {
        toast.info('No company location saved yet — add it once on your profile and it auto-fills next time')
      }
      loadedRef.current = true
      return
    }
    api(`/postings/${id}`, { token })
      .then((p) =>
        setForm({
          title: p.title,
          description: p.description,
          requirements: p.requirements,
          course_tags: p.course_tags,
          slots: p.slots,
          city: p.city,
          address: p.address,
          lat: p.lat,
          lng: p.lng
        })
      )
      .finally(() => setLoadingEdit(false))
      .catch((e) => toast.error(e.message))
  }, [id, isEdit, token])

  useEffect(() => {
    if (!loadedRef.current) return
    const draft = loadDraft()
    if (draft?.data && draft.savedAt && draft.savedAt > Date.now() - 1000) return
    saveDraft(form)
    setDraftAvailable(false)
  }, [form, isEdit])

  useEffect(() => {
    api('/verify/status', { token }).then(setVerify).catch(() => {})
  }, [token])

  if (loadingEdit) return <Spinner />

  if (verify && !verify.verified) {
    return (
      <div className="page">
        <Link className="back-link" to="/company">← Dashboard</Link>
        <div className="card card-pad">
          <div className="empty-state">
            <div className="empty-emoji">🔒</div>
            <h3>Verification required</h3>
            <p>
              Your company must be verified before you can {isEdit ? 'edit' : 'post'} OJT openings.
              Upload a valid ID and your credentials/papers (SEC/DTI registration, permits) on your profile
              to prevent false applications.
            </p>
            <Link className="btn btn-primary" to="/company/profile">Go to verification</Link>
          </div>
        </div>
      </div>
    )
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const restoreDraft = () => {
    const draft = loadDraft()
    if (!draft?.data) return
    setForm({ ...draft.data })
    setDraftAvailable(false)
    toast.success('Draft restored')
  }

  const toggleTag = (t) => {
    const has = form.course_tags.includes(t)
    set('course_tags', has ? form.course_tags.filter((x) => x !== t) : [...form.course_tags, t])
  }

  const pickCity = (city) => {
    set('city', city)
    const c = CITY_COORDS[city]
    if (c && !form.lat) {
      set('lat', c[0])
      set('lng', c[1])
    }
  }

  const submit = async () => {
    if (!form.title.trim()) return toast.error('Add a title')
    if (!form.course_tags.length) return toast.error('Select at least one course')
    if (form.lat == null || form.lng == null) return toast.error('Set the office location on the map')

    const ok = await confirm({
      title: isEdit ? 'Save changes?' : 'Publish posting?',
      message: isEdit
        ? `Your changes to "${form.title}" will be saved and shown to all applicants.`
        : `"${form.title}" will be published and visible to OJT applicants in your area.`,
      confirmLabel: isEdit ? 'Save changes' : 'Publish posting',
      danger: false
    })
    if (!ok) return

    try {
      const body = {
        title: form.title,
        description: form.description,
        requirements: form.requirements,
        course_tags: form.course_tags,
        slots: form.slots,
        city: form.city,
        address: form.address,
        lat: form.lat,
        lng: form.lng
      }
      if (isEdit) {
        await api(`/postings/${id}`, { method: 'PUT', token, body })
        toast.success('Posting updated')
      } else {
        await api('/postings', { method: 'POST', token, body })
        toast.success('Posting published! Applicants can now find you.')
      }
      clearDraft()
      navigate('/company')
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="page">
      <Link className="back-link" to="/company">← Dashboard</Link>
      <header className="page-head">
        <div>
          <h1>{isEdit ? 'Edit posting' : 'New OJT posting'}</h1>
          <p className="muted">Tell applicants what your internship offers — the more specific, the better.</p>
        </div>
      </header>

      {draftAvailable && (
        <div className="draft-banner">
          <span>Unsaved changes from a previous session were found.</span>
          <button className="btn btn-sm btn-primary" onClick={restoreDraft}>Restore draft</button>
        </div>
      )}

      <div className="card card-pad posting-form">
        <h3>Role</h3>
        <div className="form-grid">
          <label className="field full">Position title
            <input className="input" placeholder="e.g. IT Helpdesk Intern" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <div className="field full">
            <span className="field-label">Open to these courses</span>
            <div className="skill-picker">
              {COURSES.map((c) => (
                <button key={c} type="button" className={'skill-chip' + (form.course_tags.includes(c) ? ' on' : '')} onClick={() => toggleTag(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <label className="field">Slots available
            <input type="number" min="1" max="50" className="input" value={form.slots} onChange={(e) => set('slots', Math.max(1, Number(e.target.value) || 1))} />
          </label>
        </div>

        <h3>Description</h3>
        <label className="field full">
          <textarea className="input textarea" rows={4} placeholder="What will the intern do day to day?" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <h3>Requirements</h3>
        <label className="field full">
          <textarea className="input textarea" rows={3} placeholder="Skills, tools, or conditions the intern should meet…" value={form.requirements} onChange={(e) => set('requirements', e.target.value)} />
        </label>

        <h3>Location</h3>
        <div className="form-grid">
          <label className="field">City
            <select className="input" value={form.city} onChange={(e) => pickCity(e.target.value)}>
              <option value="">— select —</option>
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field full">Office address
            <input className="input" placeholder="Street, building, city" value={form.address} onChange={(e) => set('address', e.target.value)} />
          </label>
          <label className="field full">
            <span className="field-label">Pin the office on the map</span>
            <LocationPicker
              value={form.lat != null ? [form.lat, form.lng] : undefined}
              onChange={(c) => { set('lat', c.lat); set('lng', c.lng) }}
            />
          </label>
          <div className="field full">
            <button type="button" className="btn btn-ghost" onClick={() => applyCompanyLocation()}>
              📍 Use my company office location {co.lat != null ? <em className="muted" style={{ fontStyle: 'normal' }}>({String(co.address || '').slice(0, 30)})</em> : ''}
            </button>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={submit}>{isEdit ? 'Save changes' : 'Publish posting'}</button>
        </div>
      </div>
    </div>
  )
}