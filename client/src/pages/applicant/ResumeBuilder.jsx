import { useEffect, useState } from 'react'
import { useAuth } from '../../store.jsx'
import { api } from '../../api.js'
import { Spinner, emptyState } from '../../components/ui.jsx'
import { toast } from '../../toast.jsx'

const EMPTY = { summary: '', skills: [], education: [], experience: [], projects: [], certifications: [] }

function AddRowForm({ fields, setFields, field, placeholders, buttonLabel }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(placeholders.map((p) => [p.key, ''])))
  const add = (e) => {
    e.preventDefault()
    if (!draft[placeholders[0].key]) return
    setFields({ ...fields, [field]: [...fields[field], { ...draft }] })
    setDraft(Object.fromEntries(placeholders.map((p) => [p.key, ''])))
  }
  const remove = (i) => setFields({ ...fields, [field]: fields[field].filter((_, idx) => idx !== i) })
  const setDraftField = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  return (
    <div>
      <div className="form-grid three">
        {placeholders.map((p) => (
          <label key={p.key} className="field">
            <span className="field-label">{p.label}</span>
            {p.area ? (
              <textarea
                className="input textarea"
                rows={2}
                placeholder={p.label}
                value={draft[p.key]}
                onChange={(e) => setDraftField(p.key, e.target.value)}
              />
            ) : (
              <input className="input" placeholder={p.label} value={draft[p.key]} onChange={(e) => setDraftField(p.key, e.target.value)} />
            )}
          </label>
        ))}
        <div className="field add-field">
          <button className="btn btn-ghost" onClick={add}>+ {buttonLabel}</button>
        </div>
      </div>
      {fields[field].length > 0 && (
        <div className="chips">
          {fields[field].map((item, i) => (
            <span key={i} className="chip-item">
              {item[placeholders[0].key]}
              <button type="button" className="chip-x" onClick={() => remove(i)}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ResumeBuilder() {
  const { token, user } = useAuth()
  const [resume, setResume] = useState(null)
  const [skills, setSkills] = useState([])
  const [customSkill, setCustomSkill] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/resume/my', { token }).then((r) => {
      setResume(r)
      setSkills(r.data.skills || [])
    }).catch(() => setResume({ data: EMPTY }))
  }, [token])

  useEffect(() => {
    const course = user?.profile?.course
    if (!course) return
    api(`/resume/suggestions?course=${encodeURIComponent(course)}`, { token }).then((s) => {
      setSkills((prev) => (prev.length ? prev : s.skills))
      setResume((prev) => {
        if (!prev) return prev
        if (!prev.data.summary && s.objective) {
          return { ...prev, data: { ...prev.data, summary: `${s.objective}`.slice(0, 280) } }
        }
        return prev
      })
    }).catch(() => {})
  }, [token, user?.profile?.course])

  if (!resume) return <Spinner />

  const setFields = (next) => setResume((r) => ({ ...r, data: next }))

  const toggleSkill = (s) => {
    const sel = new Set(skills)
    if (sel.has(s)) sel.delete(s)
    else sel.add(s)
    setSkills([...sel])
    setFields({ ...resume.data, skills: [...sel] })
  }

  const addCustomSkill = () => {
    const s = customSkill.trim()
    if (!s) return
    if (!skills.includes(s)) {
      const next = [...skills, s]
      setSkills(next)
      setFields({ ...resume.data, skills: next })
    }
    setCustomSkill('')
  }

  const save = async () => {
    setSaving(true)
    try {
      await api('/resume/my', { method: 'PUT', token, body: { data: resume.data } })
      toast.success('Resume saved')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const hasContent =
    (resume.data.summary || resume.data.skills.length || resume.data.education.length ||
      resume.data.experience.length || resume.data.projects.length || resume.data.certifications.length)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Resume Builder</h1>
          <p className="muted">Smart suggestions are auto-filled for {user?.profile?.course || 'your course'}. Build once, attach to any application's chat.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save resume'}</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ Print / PDF</button>
        </div>
      </header>

      <div className="rb-grid">
        <div className="rb-form">
          <div className="card card-pad">
            <h3>Objective</h3>
            <textarea
              className="input textarea"
              rows={4}
              placeholder="A short paragraph about what you're after in this OJT…"
              value={resume.data.summary}
              onChange={(e) => setFields({ ...resume.data, summary: e.target.value })}
            />
          </div>

          <div className="card card-pad">
            <h3>Skills</h3>
            <p className="muted small">Suggested for {user?.profile?.course || 'your course'} — click to add or remove.</p>
            <div className="skill-picker">
              {skills.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={'skill-chip' + (resume.data.skills.includes(s) ? ' on' : '')}
                  onClick={() => toggleSkill(s)}
                >
                  {s}
                  {resume.data.skills.includes(s) ? ' ✓' : ''}
                </button>
              ))}
            </div>
            <div className="combo">
              <input
                className="input"
                placeholder="Add your own skill…"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomSkill()}
              />
              <button className="btn btn-ghost" onClick={addCustomSkill}>Add</button>
            </div>
          </div>

          <div className="card card-pad">
            <h3>Education</h3>
            <AddRowForm
              fields={resume.data}
              setFields={setFields}
              field="education"
              buttonLabel="Add education"
              placeholders={[
                { key: 'school', label: 'School' },
                { key: 'course', label: 'Course / program' },
                { key: 'year', label: 'Expected year' }
              ]}
            />
          </div>

          <div className="card card-pad">
            <h3>Experience &amp; trainings</h3>
            <AddRowForm
              fields={resume.data}
              setFields={setFields}
              field="experience"
              buttonLabel="Add experience"
              placeholders={[
                { key: 'role', label: 'Role / position' },
                { key: 'org', label: 'Organization' },
                { key: 'years', label: 'Dates' },
                { key: 'description', label: 'Short description', area: true }
              ]}
            />
          </div>

          <div className="card card-pad">
            <h3>Projects</h3>
            <AddRowForm
              fields={resume.data}
              setFields={setFields}
              field="projects"
              buttonLabel="Add project"
              placeholders={[
                { key: 'name', label: 'Project name' },
                { key: 'description', label: 'Short description', area: true }
              ]}
            />
          </div>

          <div className="card card-pad">
            <h3>Certifications</h3>
            <AddRowForm
              fields={resume.data}
              setFields={setFields}
              field="certifications"
              buttonLabel="Add certification"
              placeholders={[
                { key: 'name', label: 'Certification' },
                { key: 'year', label: 'Year' }
              ]}
            />
          </div>
        </div>

        <div className="rb-preview">
          <div className="rb-preview-label muted">Live preview</div>
          {!hasContent ? (
            <div className="card card-pad print-area">
              {emptyState('Your resume preview', 'Fill in the sections and your clean print-ready resume appears here.')}
            </div>
          ) : (
            <div id="print-area" className="print-area">
              <ResumePrint resume={resume.data} user={user} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResumePrint({ resume, user }) {
  const p = user?.profile || {}
  return (
    <div className="resume-paper">
      <header className="rp-head">
        <h1>{user.name}</h1>
        <p className="rp-line">{p.course}{p.year_level ? ` — ${p.year_level}` : ''}</p>
        <p className="rp-line muted">{[user.email, p.phone, p.school_name].filter(Boolean).join('  |  ')}</p>
      </header>

      {resume.summary && <section><h2>Objective</h2><p>{resume.summary}</p></section>}

      {resume.skills.length > 0 && (
        <section><h2>Skills</h2><p>{resume.skills.join('  •  ')}</p></section>
      )}

      {resume.education.length > 0 && (
        <section>
          <h2>Education</h2>
          {resume.education.map((e, i) => (
            <div key={i} className="rp-item">
              <strong>{e.school}</strong>
              <span className="muted">{[e.course, e.year].filter(Boolean).join(' — ')}</span>
            </div>
          ))}
        </section>
      )}

      {resume.experience.length > 0 && (
        <section>
          <h2>Experience &amp; trainings</h2>
          {resume.experience.map((x, i) => (
            <div key={i} className="rp-item">
              <strong>{[x.role, x.org].filter(Boolean).join(' · ')}</strong>
              {x.years && <span className="muted">{x.years}</span>}
              {x.description && <p>{x.description}</p>}
            </div>
          ))}
        </section>
      )}

      {resume.projects.length > 0 && (
        <section>
          <h2>Projects</h2>
          {resume.projects.map((p, i) => (
            <div key={i} className="rp-item">
              <strong>{p.name}</strong>
              {p.description && <p>{p.description}</p>}
            </div>
          ))}
        </section>
      )}

      {resume.certifications.length > 0 && (
        <section>
          <h2>Certifications</h2>
          {resume.certifications.map((c, i) => (
            <div key={i} className="rp-item">
              <span>• {[c.name, c.year].filter(Boolean).join(' — ')}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}