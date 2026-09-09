import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../store.jsx'
import { api, fmtDateTime } from '../../api.js'
import ChatBox from '../../components/ChatBox.jsx'
import { Spinner, emptyState } from '../../components/ui.jsx'

export default function SchoolMessages() {
  const { token } = useAuth()
  const [params] = useSearchParams()
  const [threads, setThreads] = useState(null)
  const [active, setActive] = useState(null)

  const load = () => {
    api('/chat/school-threads', { token })
      .then((r) => {
        setThreads(r.threads || [])
        setActive((cur) => {
          if (cur) return cur
          const list = r.threads || []
          const want = Number(params.get('student'))
          const t = list.find((x) => Number(x.studentId) === want) || list[0]
          return t ? { studentId: t.studentId, name: t.name } : null
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
            <p className="muted">Chat with your students — send follow-up requests for documents and updates.</p>
          </div>
        </header>
        <div className="card card-pad">
          {emptyState(
            'No conversations yet',
            'When students message your school, their conversations will appear here. You can also start a chat from any student\u2019s page.',
            <Link className="btn btn-primary" to="/school">Go to my students</Link>
          )}
        </div>
      </div>
    )
  }

  const open = (t) => setActive({ studentId: t.studentId, name: t.name })

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>💬 Messages</h1>
          <p className="muted">Chat with your students — send follow-up requests for documents and updates.</p>
        </div>
      </header>

      <div className="msg-layout">
        <aside className="thread-list card">
          {threads.map((t) => (
            <button
              key={t.studentId}
              className={'thread-item' + (active?.studentId === t.studentId ? ' active' : '')}
              onClick={() => open(t)}
            >
              <div className="thread-avatar">
                {String(t.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="thread-meta">
                <div className="thread-top">
                  <strong className="thread-name">{t.name}</strong>
                  {t.last?.created_at && <span className="thread-time">{fmtDateTime(t.last.created_at)}</span>}
                </div>
                <span className="muted small thread-sub">{t.studentIdNumber ? `🪪 ${t.studentIdNumber}` : t.email || ''}</span>
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
                <strong>{active.name}</strong>
                <span className="muted small">Student chat — send follow-up requests for documents and updates.</span>
              </div>
              <ChatBox key={`s${active.studentId}`} thread={{ type: 'school', studentId: active.studentId }} title={active.name} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}