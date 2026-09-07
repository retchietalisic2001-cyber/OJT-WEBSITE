import { useEffect, useRef, useState } from 'react'
import { api, fmtDateTime } from '../api.js'
import { getSocket } from '../socket.js'
import { useAuth } from '../store.jsx'
import { toast } from '../toast.jsx'

export default function ChatBox({ applicationId }) {
  const { token, user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendingFile, setSendingFile] = useState(false)
  const [typingLabel, setTypingLabel] = useState(null)
  const fileRef = useRef(null)
  const bodyRef = useRef(null)
  const typingTimer = useRef(null)

  useEffect(() => {
    let alive = true
    api(`/messages/${applicationId}`, { token })
      .then((rows) => {
        if (alive) setMessages(rows)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [applicationId, token])

  useEffect(() => {
    if (loading) return
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [messages, loading])

  useEffect(() => {
    const socket = getSocket(token)
    socket.emit('join', applicationId)

    const onNew = (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
      setSending(false)
      setSendingFile(false)
    }
    const onJoinErr = (d) => toast.error(d.message)
    socket.on('message:new', onNew)
    socket.on('join-error', onJoinErr)
    return () => {
      socket.off('message:new', onNew)
      socket.off('join-error', onJoinErr)
    }
  }, [applicationId, token])

  const send = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    const temp = { id: `t${Date.now()}`, content, sender_id: user.id, sender_role: user.role, file_name: null, category: null, _tmp: true }
    setMessages((prev) => [...prev, temp])
    setText('')
    try {
      await api(`/messages/${applicationId}`, { method: 'POST', token, body: { content } })
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id))
      toast.error(e.message)
      setSending(false)
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSendingFile(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('content', '')
    const temp = {
      id: `f${Date.now()}`,
      content: '',
      sender_id: user.id,
      sender_role: user.role,
      file_name: file.name,
      file_path: '',
      category: 'file',
      _tmp: true
    }
    setMessages((prev) => [...prev, temp])
    try {
      await api(`/messages/${applicationId}/upload`, { method: 'POST', token, form: fd })
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id))
      toast.error(err.message)
      setSendingFile(false)
    }
  }

  const onTyping = (e) => {
    setText(e.target.value)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      const socket = getSocket(token)
      socket.emit('typing', { applicationId, sender: user.name })
    }, 200)
  }

  useEffect(() => {
    const socket = getSocket(token)
    const onTyping = ({ applicationId: id, sender }) => {
      if (id !== applicationId || sender === user.name) return
      setTypingLabel(`${sender} is typing…`)
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setTypingLabel(null), 2500)
    }
    const onJoined = () => {}
    socket.on('typing', onTyping)
    socket.on('joined', onJoined)
    return () => {
      socket.off('typing', onTyping)
      socket.off('joined', onJoined)
    }
  }, [applicationId, token, user.name])

  return (
    <div className="chatbox">
      <div className="chat-body" ref={bodyRef}>
        {loading && <div className="chat-hint">Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div className="chat-hint">
            No messages yet. Start the conversation — you can send documents or photos here so no one has to visit the office just to submit requirements.
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} m={m} isMine={m.sender_id === user.id} />
        ))}
        {typingLabel && <div className="chat-hint typing-hint">{typingLabel}</div>}
      </div>
      <div className="chat-composer">
        <div className="composer-row">
          <input
            className="chat-input"
            placeholder="Type a message…"
            value={text}
            onChange={onTyping}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={sending || sendingFile}
          />
          <button className="icon-btn attach-btn" title="Attach a document or photo" onClick={() => fileRef.current?.click()} disabled={sendingFile}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.4 13.6l-7.7 7.7a5 5 0 0 1-7.1-7.1l8.9-8.8a3.3 3.3 0 0 1 4.7 4.7l-8.9 8.8a1.6 1.6 0 0 1-2.3-2.3l8.3-8.3" />
            </svg>
          </button>
          <input ref={fileRef} type="file" hidden onChange={onFile} accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
          <button className="btn btn-primary send-btn" onClick={send} disabled={!text.trim() || sending}>
            {sending ? '…' : 'Send'}
          </button>
        </div>
        {sendingFile && <div className="chat-hint">Uploading file…</div>}
      </div>
    </div>
  )
}

function ChatBubble({ m, isMine }) {
  const isImage = m.category === 'image' && m.file_path
  return (
    <div className={'bubble-row ' + (isMine ? 'mine' : 'theirs')}>
      <div className="bubble">
        {isImage ? (
          <img className="bubble-img" src={m.file_path} alt={m.file_name} />
        ) : m.file_path ? (
          <a className="bubble-file" href={m.file_path} target="_blank" rel="noreferrer">
            <span className="file-ic">
              {m.category === 'pdf' ? 'PDF' : m.category === 'doc' ? 'DOC' : 'FILE'}
            </span>
            <span>
              <strong>{m.file_name}</strong>
              <em>Open / download</em>
            </span>
          </a>
        ) : null}
        {m.content && <p className="bubble-text">{m.content}</p>}
        <span className="bubble-time">{m._tmp ? 'Sending…' : fmtDateTime(m.created_at)}</span>
      </div>
    </div>
  )
}