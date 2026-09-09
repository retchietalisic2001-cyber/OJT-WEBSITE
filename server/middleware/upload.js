import multer from 'multer'
import path from 'node:path'
import crypto from 'node:crypto'
import { UPLOADS_DIR } from '../db.js'

const ALLOWED_MIME = new Set([
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

export function uploadFor(maxBytes) {
  return multer({
    storage: multer.diskStorage({
      destination: UPLOADS_DIR,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().slice(0, 10)
        const key = crypto.randomBytes(6).toString('hex')
        cb(null, `${Date.now()}_${key}${ext}`)
      }
    }),
    limits: { fileSize: maxBytes },
    fileFilter: (req, file, cb) => {
      const ok = ALLOWED_MIME.has(file.mimetype)
      if (ok) return cb(null, true)
      cb(new Error('Only images, PDF, Word, Excel and text files are allowed'))
    }
  })
}

export const upload = uploadFor(10 * 1024 * 1024)

export function mimeCategory(mime) {
  if (!mime) return 'file'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('word') || mime.includes('excel')) return 'doc'
  return 'file'
}