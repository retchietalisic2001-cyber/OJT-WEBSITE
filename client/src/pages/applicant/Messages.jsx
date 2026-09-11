import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api, fmtDateTime } from '../../api.js'
import ChatBox from '../../components/ChatBox.jsx'
import { Spinner, emptyState } from '../../components/ui.jsx'

export default function Messages() {
  const { token, user } = useAuth()
  const [params] = useSearchParams()
  const [threads, setThreads] = useState(null)
  const [active, setActive] = useState(null)

  const load = () => {
    api('/chat/my-threads', { token })
      .then((r) => {
        setThreads(r.threads || [])
        setActive((cur) => {
          if (cur) return cur
          const list = r.threads || []
          const wantApp = Number(params.get('application'))
          const wantSchool = params.get('school')
          const t = list.find((x) => x.type === 'application' && Number(x.applicationId) === wantApp)
            || list.find((x) => x.type === 'school') && wantSchool
            || list[0]
          return t ? { key: t.key, type: t.type, applicationId: t.applicationId, studentId: t.type === 'school' ? user.id : undefined, name: t.name } : null
        })
      })
      .catch(() => setThreads([]))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!active) return
    const t = setTimeout(load, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  if (!threads) return <Spinner />

  if (threads.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <h1>💬 Messages</h1>
            <p className="muted">Chat with your school and the companies that accepted you.</p>
          </div>
        </header>
        <div className="card card-pad">
          {emptyState(
            'No conversations yet',
            'Once you belong to a school or get accepted by a company, you can chat with them here to send follow-up documents and updates.',
            null
          )}
        </div>
      </div>
    )
  }

  const open = (t) => setActive({ key: t.key, type: t.type, applicationId: t.applicationId, studentId: t.type === 'school' ? user.id : undefined, name: t.name })

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>💬 Messages</h1>
          <p className="muted">Chat with your school and the companies that accepted you — send follow-up documents or ask anything.</p>
        </div>
      </header>

      <div className="msg-layout">
        <aside className="thread-list card">
          {threads.map((t) => (
            <button
              key={t.key}
              className={'thread-item' + (active?.key === t.key ? ' active' : '')}
              onClick={() => open(t)}
            >
              <div className="thread-avatar">
                {t.logo ? <img src={t.logo} alt={t.name} /> : t.type === 'school' ? '🏫' : '🏢'}
              </div>
              <div className="thread-meta">
                <div className="thread-top">
                  <strong className="thread-name">{t.name}</strong>
                  {t.last?.created_at && <span className="thread-time">{fmtDateTime(t.last.created_at)}</span>}
                </div>
                {t.subtitle && <span className="muted small thread-sub">{t.subtitle}</span>}
                <span className="thread-preview">
                  {t.last ? (
                    <>
                      {t.last.file_name && '📎 '}
                      {t.last.content || t.last.file_name}
                    </>
                  ) : (
                    'No messages yet'
                  )}
                </span>
              </div>
              {t.unread > 0 && <span className="unread-badge">{t.unread}</span>}
            </button>
          ))}
        </aside>

        <div className="msg-main card">
          {active ? (
            <>
              <div className="msg-head">
                <strong>{active.type === 'school' ? '🏫 ' : '🏢 '}{active.name}</strong>
                {active.type === 'school' && <span className="muted small">School chat — your OJT coordinator</span>}
                {active.type === 'application' && <span className="muted small">Company chat — accepted application</span>}
              </div>
              <ChatBox
                key={active.key}
                thread={active.type === 'school' ? { type: 'school', studentId: active.studentId } : { type: 'application', applicationId: active.applicationId }}
                title={active.name}
              />
            </>
          ) : null}
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>
        Need to chat with a company you haven't accepted yet? Open it from{' '}
        <Link className="link-btn" to="/app/applications">My Applications</Link>.
      </p>
    </div>
  )
}