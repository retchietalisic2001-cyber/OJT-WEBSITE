import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { UPLOADS_DIR } from '../db.js'

export function generateResumePdf(applicant, profile, schoolName, resume, outName) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 52, right: 52 },
    bufferPages: true
  })

  const filename = outName || `resume_${applicant.id}.pdf`
  const filePath = path.join(UPLOADS_DIR, filename)
  doc.pipe(fs.createWriteStream(filePath))

  const color = '#5B4BDB'
  const gray = '#6B7280'
  const dark = '#1F2333'

  const moveDown = (n = 1) => doc.moveDown(n)

  const section = (title) => {
    moveDown(1.1)
    doc.fillColor(color).fontSize(12).font('Helvetica-Bold').text(title.toUpperCase())
    const y = doc.y + 3
    doc.moveTo(doc.x, y).lineWidth(1.2).strokeColor(color).lineTo(doc.page.width - doc.x, y).stroke()
    moveDown(0.6)
  }

  const bullet = (text) => {
    doc.font('Helvetica').fontSize(10.5).fillColor(dark).text(`•  ${text}`, { lineGap: 2 })
    moveDown(0.25)
  }

  const contact = [applicant.email]
  if (profile?.phone) contact.push(profile.phone)
  if (schoolName) contact.push(schoolName)
  const courseLine = profile?.course ? `${profile.course}${profile.year_level ? ' — ' + profile.year_level : ''}` : ''

  doc.font('Helvetica-Bold').fontSize(26).fillColor(color).text(applicant.name, { lineGap: 2 })
  if (courseLine) doc.font('Helvetica').fontSize(11).fillColor(gray).text(courseLine)
  if (contact.length) doc.font('Helvetica').fontSize(10).fillColor(dark).text(contact.join('  |  '), { lineGap: 2 })

  const data = typeof resume?.data === 'string' ? safeParse(resume.data) : resume?.data || {}

  if (data.summary) {
    section('Objective')
    doc.font('Helvetica').fontSize(10.5).fillColor(dark).text(data.summary, { lineGap: 2, align: 'justify' })
  }

  if (Array.isArray(data.skills) && data.skills.length) {
    section('Skills')
    doc.font('Helvetica').fontSize(10).fillColor(dark).text(data.skills.join('  •  '), { lineGap: 3 })
  }

  const education = Array.isArray(data.education) ? data.education : []
  if (education.length) {
    section('Education')
    for (const e of education) {
      if (!e.school && !e.course) continue
      doc.font('Helvetica-Bold').fontSize(11).fillColor(dark).text(e.school || e.course)
      doc.font('Helvetica').fontSize(10).fillColor(gray).text(`${e.course || ''}${e.year ? ' — ' + e.year : ''}`)
      moveDown(0.4)
    }
  }

  const experience = Array.isArray(data.experience) ? data.experience : []
  if (experience.length) {
    section('Experience & Trainings')
    for (const item of experience) {
      if (!item.role && !item.org) continue
      const head = [item.role, item.org].filter(Boolean).join('  ·  ')
      doc.font('Helvetica-Bold').fontSize(11).fillColor(dark).text(head)
      if (item.years) doc.font('Helvetica').fontSize(9.5).fillColor(gray).text(item.years)
      if (item.description) {
        doc.font('Helvetica').fontSize(10).fillColor(dark).text(item.description, { lineGap: 2 })
      }
      moveDown(0.4)
    }
  }

  const projects = Array.isArray(data.projects) ? data.projects : []
  if (projects.length) {
    section('Projects')
    for (const item of projects) {
      if (!item.name) continue
      doc.font('Helvetica-Bold').fontSize(11).fillColor(dark).text(item.name)
      if (item.description) doc.font('Helvetica').fontSize(10).fillColor(dark).text(item.description, { lineGap: 2 })
      moveDown(0.4)
    }
  }

  const certifications = Array.isArray(data.certifications) ? data.certifications : []
  if (certifications.length) {
    section('Certifications')
    for (const c of certifications) {
      if (c.name) bullet([c.name, c.year].filter(Boolean).join(' — '))
    }
  }

  doc.font('Helvetica').fontSize(9).fillColor(gray).text('Generated with OJT Connect', 52, doc.page.height - 40, { align: 'center' })

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve({ filePath, filename }))
    doc.on('error', reject)
    doc.end()
  })
}

function safeParse(str) {
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}