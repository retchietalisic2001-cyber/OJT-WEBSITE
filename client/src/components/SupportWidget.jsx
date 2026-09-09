import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useConfirm } from '../confirm.jsx'

const MENU_CHIPS = [
  { id: 'student', label: '🎓 I am a student' },
  { id: 'employer', label: '🏢 I am an employer' },
  { id: 'school', label: '🏫 I am from a school / university' },
  { id: 'how', label: '❓ How it works' }
]

const FIELDS = {
  company: [
    { key: 'company', label: 'Company name', placeholder: 'e.g. TechNova Solutions' },
    { key: 'industry', label: 'Industry', placeholder: 'e.g. IT Services' },
    { key: 'contact', label: 'Contact person full name', placeholder: 'e.g. Ana Reyes' },
    { key: 'email', label: 'Work email address', placeholder: 'person@company.com' },
    { key: 'phone', label: 'Contact number', placeholder: '09xx xxx xxxx' },
    { key: 'address', label: 'Head office address', placeholder: 'Street, City' }
  ],
  school: [
    { key: 'school', label: 'School / university name', placeholder: 'e.g. University of the East' },
    { key: 'coordinator', label: 'Coordinator / contact person', placeholder: 'e.g. Ms. Angela Reyes' },
    { key: 'email', label: 'School email address', placeholder: 'coordinator@school.edu.ph' },
    { key: 'phone', label: 'Contact number', placeholder: '09xx xxx xxxx' },
    { key: 'position', label: 'Position / role', placeholder: 'OJT Coordinator' }
  ]
}

const EMAIL_RE = /^\S+@\S+\.\S+$/

const ACCEPTED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
])
const ACCEPTED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt']

function isSupportedType(file) {
  if (ACCEPTED_MIME.has(file.type)) return true
  const ext = String(file.name || '').split('.').pop().toLowerCase()
  return ACCEPTED_EXT.includes(ext)
}

function validateField(key, value) {
  const v = String(value || '').trim()
  if (!v) return 'Please type something for this field.'
  if (key === 'email' && !EMAIL_RE.test(v)) {
    return "That email doesn't look right — please type a valid email like you@example.com."
  }
  if (key === 'phone') {
    const p = v.replace(/[\s\-()]/g, '')
    const ok = /^(\+639|639|09)\d{9}$/.test(p)
    if (!ok) return "That number doesn't look right — please type a valid contact number like 09xx xxx xxxx."
  }
  return null
}

export default function SupportWidget() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState({ online: false })
  const [msgs, setMsgs] = useState([])
  const [chips, setChips] = useState(MENU_CHIPS)
  const [collect, setCollect] = useState(null)
  const [answers, setAnswers] = useState({})
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadPhase, setUploadPhase] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingKind, setPendingKind] = useState(null)
  const bodyRef = useRef(null)

  const push = (from, text) => setMsgs((m) => [...m, { from, text }])

  useEffect(() => {
    let alive = true
    const poll = () => {
      api('/support', { method: 'GET' })
        .then((d) => alive && setStatus(d))
        .catch(() => {})
    }
    if (open) {
      poll()
      const t = setInterval(poll, 30000)
      return () => {
        alive = false
        clearInterval(t)
      }
    }
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, chips, collect])

  const openChat = () => {
    setOpen(true)
    if (msgs.length === 0) {
      push('bot', "👋 Hi there! Welcome to OJT Connect. I'm here to help you get started.")
      setTimeout(() => {
        push('bot', 'How can we help you today?')
        setChips(MENU_CHIPS)
      }, 350)
    }
  }

  const goMenu = () => {
    push('bot', 'What else can I help you with?')
    setChips(MENU_CHIPS)
    setCollect(null)
    setAnswers({})
    setUploadPhase(false)
    setPendingKind(null)
  }

  const routeChip = (id) => {
    if (id === 'menu') return goMenu()
    if (id === 'signup') return navigate('/login')
    if (id === 'student') return studentFlow()
    if (id === 'employer') return startCollect('company')
    if (id === 'school') return startCollect('school')
    if (id === 'how') return howFlow()
  }

  const studentFlow = () => {
    setTimeout(() => {
      push('bot', "🎓 That's great! Students sign up directly — no admin needed.")
      setChips([{ id: 'signup', label: '📝 Go to sign up' }, { id: 'menu', label: '🔙 Main menu' }])
    }, 250)
  }

  const howFlow = () => {
    setTimeout(() => {
      push('bot', 'Here is how OJT Connect works:\n\n🎓 Students — create an account, browse OJT openings near you, apply with one click, and chat with companies.\n\n🏢 Employers — verified companies post OJT openings and receive applications. Company accounts are created & verified by our admin to stop fake offers.\n\n🏫 Schools — coordinators monitor their students’ OJT progress in real time. School accounts are created & verified by our admin too.')
      setChips([{ id: 'menu', label: '🔙 Main menu' }])
    }, 250)
  }

  const startCollect = (kind) => {
    setAnswers({})
    setChips([])
    setTimeout(() => {
      push('bot', kind === 'company'
        ? "🏢 Excellent! To protect students from fake OJT offers, company accounts are created and verified by our admin. I'll collect a few details and send them over — our admin will verify your business and create the account for you."
        : "🏫 Great! School coordinator accounts are created and verified by our admin too. I'll collect a few details and send them to our admin for verification.")
      setCollect({ kind, step: 0 })
      setTimeout(() => push('bot', `Please type: ❓ ${FIELDS[kind][0].label}`), 300)
    }, 250)
  }

  const advance = (value) => {
    const field = FIELDS[collect.kind][collect.step]
    const v = String(value).trim()

    const invalid = validateField(field.key, v)
    push('user', v)
    if (invalid) {
      setTimeout(() => push('bot', `⚠️ ${invalid} Please try again.`), 250)
      return
    }

    const nextAnswers = { ...answers, [field.key]: v }
    setAnswers(nextAnswers)

    const nextStep = collect.step + 1
    if (nextStep < FIELDS[collect.kind].length) {
      setCollect({ ...collect, step: nextStep })
      setTimeout(() => push('bot', `Please type: ❓ ${FIELDS[collect.kind][nextStep].label}`), 250)
    } else {
      setCollect(null)
      setPendingKind(collect.kind)
      setUploadPhase(true)
      setTimeout(() => {
        push('bot', '📎 Almost done — one last step! Please attach up to 2 documents (your valid ID plus a supporting document, e.g. SEC/DTI or CHED registration, permits) so our admin can verify you. Max file size is 20MB each.')
        setChips([{ id: 'menu', label: '🔙 Main menu' }])
      }, 250)
    }
  }

  const onUploadFile = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    if (files.length > 2) {
      push('user', '📎 (selected more than 2 files)')
      setTimeout(() => push('bot', '⚠️ You can only attach up to 2 files. Please select your valid ID and one supporting document.'), 250)
      return
    }
    const tooBig = files.find((f) => f.size > 20 * 1024 * 1024)
    if (tooBig) {
      push('user', `📎 ${tooBig.name}`)
      setTimeout(() => push('bot', `⚠️ "${tooBig.name}" is larger than 20MB. Please choose smaller files.`), 250)
      return
    }
    const unsupported = files.find((f) => !isSupportedType(f))
    if (unsupported) {
      push('user', `📎 ${unsupported.name}`)
      setTimeout(() => push('bot', `⚠️ "${unsupported.name}" is not supported. Only images, PDF, Word, Excel and text files are allowed. Please choose a supported file.`), 250)
      return
    }
    const ok = await confirm({
      title: 'Submit account request?',
      message: `Your details and documents will be sent to our admin for verification. This normally takes 1–2 days.\n\nPlease make sure everything is correct before submitting.`,
      confirmLabel: 'Submit request',
      danger: false
    })
    if (!ok) return
    push('user', `📎 ${files.map((f) => f.name).join(', ')}`)
    setUploading(true)
    const fd = new FormData()
    files.forEach((f) => fd.append('file', f))
    fd.append('kind', pendingKind)
    fd.append('details', JSON.stringify(answers))
    try {
      await api('/support/requests', { method: 'POST', form: fd })
      setUploadPhase(false)
      setPendingKind(null)
      setAnswers({})
      setTimeout(() => {
        push('bot', '✅ Your request and documents have been sent to our admin! Please allow 1–2 days for the account verification. We will contact you once it is approved.')
        setChips([{ id: 'menu', label: '🔙 Main menu' }])
      }, 250)
    } catch (err) {
      setTimeout(() => push('bot', `⚠️ Sorry, something went wrong sending your request (${err.message}). Please try again with a supported file.`), 250)
    } finally {
      setUploading(false)
    }
  }

  const sendText = () => {
    const v = input.trim()
    if (!v) return
    setInput('')
    if (collect) return advance(v)
    push('user', v)
    setTimeout(() => {
      push('bot', 'I can help you with account sign-ups for students, employers, and schools. Please pick an option below 👇')
      setChips(MENU_CHIPS)
    }, 250)
  }

  const onChip = (id) => {
    const chip = [...MENU_CHIPS, { id: 'menu', label: '🔙 Main menu' }, { id: 'signup', label: '📝 Go to sign up' }].find((c) => c.id === id)
    if (chip) push('user', chip.label)
    setChips([])
    routeChip(id)
  }

  return (
    <>
      {open && (
        <div className="support-panel">
          <div className="support-head">
            <div className="support-avatar">💬</div>
            <div className="support-head-text">
              <strong>OJT Connect Support</strong>
              <span className={'support-status' + (status.online ? ' online' : ' offline')}>
                <span className="status-dot" />
                {status.online ? 'Online — we reply fast' : 'Offline — leave a message'}
              </span>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>

          <div className="support-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={'chat-msg ' + m.from}>
                {m.from === 'bot' && <span className="msg-avatar">🤖</span>}
                <div className="msg-bubble">{m.text}</div>
              </div>
            ))}
            {busy && <div className="chat-msg bot"><span className="msg-avatar">🤖</span><div className="msg-bubble typing">• • •</div></div>}
          </div>

          {chips.length > 0 && (
            <div className="support-chips">
              {chips.map((c) => (
                <button key={c.id} className="chip" onClick={() => onChip(c.id)}>{c.label}</button>
              ))}
            </div>
          )}

          {uploadPhase && (
            <div className="support-upload">
              <label className="btn btn-ghost btn-sm upload-btn">
                {uploading ? '⏳ Uploading…' : '📎 Attach documents (up to 2)'}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,image/*,application/pdf"
                  multiple
                  hidden
                  onChange={onUploadFile}
                  disabled={uploading}
                />
              </label>
              <span className="muted small">Select up to 2 · 20MB each · PDF, images, Word, Excel</span>
            </div>
          )}

          <div className="support-input">
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendText()}
              placeholder={collect ? `Type your ${FIELDS[collect.kind][collect.step].label.toLowerCase()}…` : 'Type a message…'}
            />
            <button className="btn btn-primary" onClick={sendText} disabled={busy}>➤</button>
          </div>
        </div>
      )}

      {!open && (
        <button className="support-launcher" onClick={openChat}>
          <span className="support-avatar">💬</span>
          <span className="support-launcher-text">
            <strong>Chat with us</strong>
            <span className={'support-status' + (status.online ? ' online' : ' offline')}>
              <span className="status-dot" />
              {status.online ? 'Online' : 'Offline'}
            </span>
          </span>
        </button>
      )}
    </>
  )
}