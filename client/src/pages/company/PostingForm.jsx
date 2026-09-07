import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api } from '../../api.js'
import { Spinner } from '../../components/ui.jsx'
import LocationPicker from '../../components/LocationPicker.jsx'
import { toast } from '../../toast.jsx'
import { COURSES, CITIES, CITY_COORDS } from '../../constants.js'

export default function PostingForm() {
  const { id } = useParams()
  const isEdit = !!id
  const { token } = useAuth()
  const navigate = useNavigate()
  const [loadingEdit, setLoadingEdit] = useState(isEdit)

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
    if (!isEdit) return
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

  if (loadingEdit) return <Spinner />

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

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
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={submit}>{isEdit ? 'Save changes' : 'Publish posting'}</button>
        </div>
      </div>
    </div>
  )
}