import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtDate } from '../api.js'

export const STATUS_META = {
  submitted: { label: 'Submitted', color: '#5B4BDB', bg: '#EDEAFD' },
  under_review: { label: 'Under Review', color: '#2F80ED', bg: '#E7F0FD' },
  interview: { label: 'Interview', color: '#D97706', bg: '#FDF3E3' },
  accepted: { label: 'Accepted', color: '#2FA86B', bg: '#E3F6EC' },
  rejected: { label: 'Rejected', color: '#E5484D', bg: '#FDEBEC' },
  withdrawn: { label: 'Withdrawn', color: '#8A8FA3', bg: '#EFF0F4' }
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: '#666', bg: '#eee' }
  return (
    <span className="badge" style={{ color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  )
}

export function Tag({ children }) {
  return <span className="tag">{children}</span>
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function emptyState(title, hint, action) {
  return (
    <div className="empty-state">
      <div className="empty-emoji">✦</div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  )
}

const ORDER = ['submitted', 'under_review', 'interview', 'accepted']
const TERMINAL = ['rejected', 'withdrawn']

export function StatusStepper({ history }) {
  const latest = history?.[history.length - 1]?.status
  const currentIdx = ORDER.indexOf(latest)
  const stepInfo = ORDER.map((s, i) => ({
    key: s,
    label: STATUS_META[s].label,
    done: latest === s ? true : currentIdx > i,
    current: latest === s,
    failed: false
  }))
  const failed = TERMINAL.includes(latest)
  const terminalLabel = failed ? STATUS_META[latest].label : null

  return (
    <div className="stepper">
      {stepInfo.map((s, i) => (
        <div key={s.key} className={'step' + (s.done ? ' done' : '') + (s.current && !failed ? ' current' : '')}>
          <div className="step-dot">{s.done ? '✓' : i + 1}</div>
          <span className="step-label">{s.label}</span>
        </div>
      ))}
      {failed && (
        <div className="step current failed">
          <div className="step-dot">✕</div>
          <span className="step-label">{terminalLabel}</span>
        </div>
      )}
    </div>
  )
}

export function Timeline({ history }) {
  return (
    <div className="timeline">
      {history.map((h) => (
        <div key={h.id} className="timeline-item">
          <div className="timeline-dot" style={{ background: STATUS_META[h.status]?.color || '#666' }} />
          <div className="timeline-body">
            <div className="timeline-head">
              <strong>{STATUS_META[h.status]?.label || h.status}</strong>
              <span className="muted">{fmtDate(h.created_at)}</span>
            </div>
            {h.note && <p>{h.note}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function StatCard({ icon, label, value, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: (accent || '#EDEAFD') + '', color: accent ? '#fff' : '#5B4BDB' }}>
        {icon}
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = '560px' }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width, maxWidth: 'calc(100vw - 32px)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function CourseBadge({ tag, index = 0 }) {
  const colors = ['#5B4BDB', '#2F80ED', '#0EA5A4', '#D97706', '#DB4B8B', '#3B82A0']
  const c = colors[index % colors.length]
  return (
    <span className="tag" style={{ color: c, background: c + '1A', border: `1px solid ${c}33` }}>
      {tag}
    </span>
  )
}

export function useModal() {
  const [open, setOpen] = useState(false)
  return { open, setOpen }
}

export function JobCard({ p, to, extra }) {
  return (
    <Link to={to} className="job-card">
      <div className="job-card-top">
        <div className="job-logo">{p.company_name?.charAt(0).toUpperCase()}</div>
        <div className="job-title-wrap">
          <h3>{p.title}</h3>
          <span className="muted">
            {p.company_name}{p.city ? ` — ${p.city}` : ''}
            {p.is_verified && <span className="verified-chip" title="Verified company">✓ Verified</span>}
          </span>
        </div>
        {p.distance_km != null && <span className="dist-chip">{p.distance_km.toFixed(1)} km</span>}
      </div>
      <p className="job-desc">{p.description}</p>
      <div className="job-tags">
        {(p.course_tags || []).map((t, i) => (
          <CourseBadge key={t} tag={t} index={i} />
        ))}
      </div>
      {extra}
      <div className="job-card-foot">
        <span className="muted">Required: {p.slots} slot{p.slots > 1 ? 's' : ''}</span>
        <span className="arrow">→</span>
      </div>
    </Link>
  )
}