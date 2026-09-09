import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { UPLOADS_DIR } from '../db.js'

const router = Router()

const TEXT_EXT = ['txt', 'csv', 'md', 'log', 'json', 'xml', 'html', 'rtf']
const MAX_PREVIEW = 5 * 1024 * 1024

function shorten(text, max = 40000) {
  const t = String(text || '').trim()
  return t.length > max ? `${t.slice(0, max)}\n… [truncated]` : t
}

function readZipEntries(buf) {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return []
  const count = buf.readUInt16LE(eocd + 10)
  const cdOffset = buf.readUInt32LE(eocd + 16)
  const entries = []
  let p = cdOffset
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    entries.push({ name, method, csize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function inflateEntry(buf, entry, max = 4 * 1024 * 1024) {
  if (entry.localOffset + 30 > buf.length) return null
  const nameLen = buf.readUInt16LE(entry.localOffset + 26)
  const extraLen = buf.readUInt16LE(entry.localOffset + 28)
  const dataStart = entry.localOffset + 30 + nameLen + extraLen
  const data = buf.subarray(dataStart, dataStart + entry.csize)
  if (entry.method === 0) return data
  if (entry.method === 8) return zlib.inflateRawSync(data, { maxOutputLength: max })
  return null
}

function entryByName(buf, entries, name) {
  const entry = entries.find((x) => x.name === name)
  if (!entry) return ''
  try {
    return inflateEntry(buf, entry)?.toString('utf8') || ''
  } catch {
    return ''
  }
}

function unescapeXml(xml) {
  return String(xml)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripXml(xml) {
  return unescapeXml(String(xml))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDocxText(buf) {
  const entries = readZipEntries(buf)
  const xml = entryByName(buf, entries, 'word/document.xml')
  return xml ? stripXml(xml) : ''
}

function extractXlsxText(buf) {
  const entries = readZipEntries(buf)
  const shared = entryByName(buf, entries, 'xl/sharedStrings.xml')
  const texts = [...String(shared).matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]))
  return texts.join(' · ')
}

function extractPptxText(buf) {
  const entries = readZipEntries(buf)
  const slides = entries.filter((e) => e.name.startsWith('ppt/slides/slide') && e.name.endsWith('.xml'))
  const parts = slides.map((e) => {
    try {
      return stripXml(inflateEntry(buf, e)?.toString('utf8') || '')
    } catch {
      return ''
    }
  })
  return parts.filter(Boolean).map((p, i) => `— Slide ${i + 1} —\n${p}`).join('\n\n')
}

router.get('/', async (req, res) => {
  try {
    const raw = String(req.query.path || '').split(/[\\/]/).pop()
    if (!raw) return res.status(400).json({ error: 'Missing file' })
    const file = path.join(UPLOADS_DIR, raw)
    if (!file.startsWith(UPLOADS_DIR) || file === UPLOADS_DIR) return res.status(400).json({ error: 'Invalid file path' })

    const stat = await fs.promises.stat(file).catch(() => null)
    if (!stat || !stat.isFile()) return res.status(404).json({ error: 'File not found' })
    if (stat.size > MAX_PREVIEW) return res.json({ type: 'unavailable', reason: 'File is too large to preview here.' })

    const buf = await fs.promises.readFile(file)
    const ext = path.extname(file).toLowerCase().replace('.', '')

    let text = ''
    if (TEXT_EXT.includes(ext)) text = buf.toString('utf8')
    else if (ext === 'docx') text = extractDocxText(buf)
    else if (ext === 'xlsx') text = extractXlsxText(buf)
    else if (ext === 'pptx') text = extractPptxText(buf)
    else if (['doc', 'xls', 'ppt'].includes(ext)) {
      return res.json({ type: 'unavailable', reason: 'Legacy Office format (.doc/.xls/.ppt) cannot be previewed in the browser. Please resubmit as PDF, image, or .docx/.xlsx.' })
    }

    if (text?.trim()) return res.json({ type: 'text', ext, text: shorten(text) })
    return res.json({ type: 'unavailable', reason: 'No readable text found in this file.' })
  } catch (err) {
    res.json({ type: 'unavailable', reason: 'Could not read this file.' })
  }
})

export default router