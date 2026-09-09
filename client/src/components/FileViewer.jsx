import { useEffect, useState } from 'react'
import { Modal } from './ui.jsx'

const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i
const PDF_RE = /\.pdf$/i

function sizeLabel(bytes) {
  const kb = Math.round((bytes || 0) / 1024)
  return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB'
}

function fileName(file) {
  return String(file?.file_path || '').split('/').pop() || file?.file_name || ''
}

export default function FileViewer({ files = [], index = 0, onClose }) {
  const [i, setI] = useState(0)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setI(Math.max(0, Math.min(index, files.length - 1)))
  }, [index, files.length])

  const file = files[i]
  const pendingLoad = !file || (preview && preview.path === (file.file_path || ''))

  useEffect(() => {
    if (!file) return
    setPreview(null)
    const name = fileName(file)
    if (IMG_RE.test(name) || PDF_RE.test(name)) return
    setLoading(true)
    const ctrl = new AbortController()
    fetch(`/api/preview?path=${encodeURIComponent(name)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { type: 'unavailable', reason: 'Could not load preview.' }))
      .then((p) => {
        p.path = file.file_path || ''
        setPreview(p)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, files.length])

  if (!file) return null

  const name = fileName(file)
  const isImg = IMG_RE.test(name)
  const isPdf = PDF_RE.test(name)

  const body = isImg ? (
    <img src={file.file_path} alt={file.file_name} />
  ) : isPdf ? (
    <iframe src={file.file_path} title={file.file_name} />
  ) : loading ? (
    <div className="fileview-unavailable"><span className="spinner" /></div>
  ) : preview && preview.type === 'text' ? (
    <pre className="fileview-text">{preview.text}</pre>
  ) : (
    <div className="fileview-unavailable">
      <p className="muted">{preview?.reason || 'Preview not available for this file type.'}</p>
    </div>
  )

  return (
    <Modal open onClose={onClose} title="📄 Review document" width="860px">
      <div className="fileview-head">
        <strong>{file.file_name}</strong>
        <span className="muted">· {sizeLabel(file.file_size)}{files.length > 1 ? ` · ${i + 1} of ${files.length}` : ''}</span>
      </div>
      <div className="fileview-body">{body}</div>
      {files.length > 1 && (
        <div className="fileview-nav">
          <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
          <span className="spread" />
          <button className="btn btn-ghost" disabled={i === files.length - 1} onClick={() => setI(i + 1)}>Next →</button>
        </div>
      )}
    </Modal>
  )
}