import bcrypt from 'bcryptjs'
import { db, run, get, all } from './db.js'

const PASSWORD = 'demo123'

async function main() {
  console.log('Seeding OJT Connect...')

  db.exec('DELETE FROM messages; DELETE FROM status_history; DELETE FROM applications; DELETE FROM resumes;')
  db.exec('DELETE FROM postings; DELETE FROM applicant_profiles; DELETE FROM company_profiles; DELETE FROM school_coordinators;')
  db.exec('DELETE FROM users; DELETE FROM schools;')
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('messages','status_history','applications','resumes','postings','applicant_profiles','company_profiles','school_coordinators','users','schools');")

  const hash = await bcrypt.hash(PASSWORD, 10)

  const schoolRows = [
    'Polytechnic University of the Philippines',
    'University of the East',
    'Mapúa University',
    'Far Eastern University',
    'Technological Institute of the Philippines'
  ]
  const schoolIds = {}
  for (const s of schoolRows) {
    schoolIds[s] = run(`INSERT INTO schools (name) VALUES (?)`, s)
  }

  function user(name, email, role) {
    const id = run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', name, email, hash, role)
    return { id, name, email, role }
  }

  // School coordinators
  const schoolCoord = user('Ms. Angela Reyes', 'school@demo.com', 'school')
  run('INSERT INTO school_coordinators (user_id, school_id, position) VALUES (?, ?, ?)',
    schoolCoord.id, schoolIds['University of the East'], 'OJT Coordinator')

  // Applicants
  const ap1 = user('Juan Carlos Dela Cruz', 'applicant@demo.com', 'applicant')
  run(`INSERT INTO applicant_profiles (user_id, school_id, course, year_level, phone, search_city, search_lat, search_lng)
       VALUES (?, ?, 'Information Technology', '4th Year', '0917 555 1234', 'Manila', 14.5995, 120.9842)`,
    ap1.id, schoolIds['University of the East'])

  const ap2 = user('Maria Isabel Santos', 'applicant2@demo.com', 'applicant')
  run(`INSERT INTO applicant_profiles (user_id, school_id, course, year_level, phone, search_city, search_lat, search_lng)
       VALUES (?, ?, 'Computer Science', '3rd Year', '0918 555 8765', 'Makati', 14.5547, 121.0244)`,
    ap2.id, schoolIds['University of the East'])

  const ap3 = user('Mark Angelo Bautista', 'applicant3@demo.com', 'applicant')
  run(`INSERT INTO applicant_profiles (user_id, school_id, course, year_level, phone, search_city, search_lat, search_lng)
       VALUES (?, ?, 'Electrical Engineering', '4th Year', '0920 555 2468', 'Quezon City', 14.676, 121.0437)`,
    ap3.id, schoolIds['Polytechnic University of the Philippines'])

  const ap4 = user('Camille Dizon', 'applicant4@demo.com', 'applicant')
  run(`INSERT INTO applicant_profiles (user_id, school_id, course, year_level, phone, search_city, search_lat, search_lng)
       VALUES (?, ?, 'Business Administration', '3rd Year', '0915 555 1357', 'Pasig', 14.5864, 121.0619)`,
    ap4.id, schoolIds['Far Eastern University'])

  // Companies
  const companies = [
    { name: 'TechNova Solutions', email: 'company@demo.com', company_name: 'TechNova Solutions', industry: 'IT Services',
      description: 'Software and IT solutions company serving Philippine enterprises.',
      address: '12F BGC Tech Tower, 26th St., Taguig', lat: 14.5498, lng: 121.0486 },
    { name: 'MetroBuild Engineering', email: 'company2@demo.com', company_name: 'MetroBuild Engineering', industry: 'Construction',
      description: 'Engineering and construction firm behind major infrastructure projects in NCR.',
      address: '88 Aurora Blvd., Quezon City', lat: 14.633, lng: 121.0352 },
    { name: 'DigiCore BPO', email: 'company3@demo.com', company_name: 'DigiCore BPO', industry: 'BPO / Business Services',
      description: 'Customer experience and business process outsourcing hub.',
      address: '5F One Corporate Center, Ortigas, Pasig', lat: 14.5864, lng: 121.0619 },
    { name: 'FinEdge Accounting Services', email: 'company4@demo.com', company_name: 'FinEdge Accounting Services', industry: 'Finance',
      description: 'Full-service accounting and taxation firm for SMEs.',
      address: '7F Summit Tower, Boni Ave., Mandaluyong', lat: 14.5794, lng: 121.0352 },
    { name: 'GreenLeaf Digital', email: 'company5@demo.com', company_name: 'GreenLeaf Digital', industry: 'Digital Marketing',
      description: 'Creative digital marketing agency for local and international brands.',
      address: 'BGC Corporate Center, Rizal Dr., Taguig', lat: 14.5564, lng: 121.0474 }
  ]

  const companyIds = {}
  for (const c of companies) {
    const u = user(c.name, c.email, 'company')
    companyIds[c.company_name] = u.id
    run('INSERT INTO company_profiles (user_id, company_name, industry, description, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)',
      u.id, c.company_name, c.industry, c.description, c.address, c.lat, c.lng)
  }

  // Postings
  const postings = [
    {
      title: 'IT Helpdesk Intern', company: 'TechNova Solutions', tags: ['Information Technology'],
      desc: 'Support internal staff with hardware, software, and network issues. Hands-on with ticketing tools and IT asset management.',
      req: 'Currently enrolled in an IT-related program. Basic hardware and Windows troubleshooting. Good communication skills.',
      slots: 3, city: 'Taguig', address: '12F BGC Tech Tower, 26th St., Taguig', lat: 14.5498, lng: 121.0486
    },
    {
      title: 'Software Development Trainee', company: 'TechNova Solutions', tags: ['Information Technology', 'Computer Science'],
      desc: 'Join a product squad building web apps with React and Node.js. Code review, bug fixes, and feature tasks.',
      req: 'Familiarity with JavaScript and Git preferred. Willing to learn agile development practices.',
      slots: 2, city: 'Taguig', address: '12F BGC Tech Tower, 26th St., Taguig', lat: 14.5498, lng: 121.0486
    },
    {
      title: 'Civil Engineering Assistant Intern', company: 'MetroBuild Engineering', tags: ['Civil Engineering'],
      desc: 'Assist engineers with site monitoring, quantity take-offs, and AutoCAD drafting on active infrastructure projects.',
      req: 'Civil Engineering student. Basic AutoCAD and surveying knowledge. Must be ready for field site visits.',
      slots: 2, city: 'Quezon City', address: '88 Aurora Blvd., Quezon City', lat: 14.633, lng: 121.0352
    },
    {
      title: 'Electrical Maintenance Intern', company: 'MetroBuild Engineering', tags: ['Electrical Engineering'],
      desc: 'Help with electrical systems inspection, motor maintenance, and documentation under licensed engineers.',
      req: 'Electrical Engineering student. Safety-conscious with basic electrical theory.',
      slots: 1, city: 'Quezon City', address: '88 Aurora Blvd., Quezon City', lat: 14.633, lng: 121.0352
    },
    {
      title: 'Customer Service Trainee', company: 'DigiCore BPO', tags: ['Business Administration', 'Information Technology'],
      desc: 'Handle customer inquiries, account updates, and escalations for a global client.',
      req: 'Excellent English communication. Night-shift flexibility. Any business or IT course.',
      slots: 5, city: 'Pasig', address: '5F One Corporate Center, Ortigas, Pasig', lat: 14.5864, lng: 121.0619
    },
    {
      title: 'Accounting Assistant Intern', company: 'FinEdge Accounting Services', tags: ['Accountancy', 'Business Administration'],
      desc: 'Process invoices, reconcile accounts, assist with payroll and financial statements.',
      req: 'Accountancy or business student. Proficient with Excel. Attention to detail.',
      slots: 2, city: 'Mandaluyong', address: '7F Summit Tower, Boni Ave., Mandaluyong', lat: 14.5794, lng: 121.0352
    },
    {
      title: 'Digital Marketing Intern', company: 'GreenLeaf Digital', tags: ['Multimedia Arts', 'Business Administration'],
      desc: 'Create social content, design graphics, and support campaign reporting for client brands.',
      req: 'Multimedia or business student. Canva/Photoshop skills a plus. Portfolio of school work preferred.',
      slots: 4, city: 'Taguig', address: 'BGC Corporate Center, Rizal Dr., Taguig', lat: 14.5564, lng: 121.0474
    }
  ]

  const postingIds = {}
  for (const p of postings) {
    const pid = run(
      `INSERT INTO postings (company_id, title, description, requirements, course_tags, slots, city, address, lat, lng, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      companyIds[p.company], p.title, p.desc, p.req, p.tags.join(','), p.slots, p.city, p.address, p.lat, p.lng
    )
    postingIds[p.title] = pid
  }

  // Sample applications + chat for applicant@demo.com
  const app1 = run(
    `INSERT INTO applications (posting_id, applicant_id, cover_message, status, created_at, updated_at)
     VALUES (?, ?, ?, 'under_review', datetime('now','-3 days'), datetime('now','-1 day'))`,
    postingIds['IT Helpdesk Intern'], ap1.id,
    'Good day! I am an IT student looking to gain hands-on helpdesk experience. I am available to start immediately and am willing to learn fast.'
  )
  for (const h of [
    ['submitted', 'Your application was submitted'],
    ['under_review', 'We received your application and are reviewing your profile with the IT team.']
  ]) {
    run('INSERT INTO status_history (application_id, status, note) VALUES (?, ?, ?)', app1, h[0], h[1])
  }

  run(
    `INSERT INTO messages (application_id, sender_id, sender_role, content, created_at) VALUES (?, ?, 'company', 'Hi Juan! Thanks for applying to the IT Helpdesk Intern role. Could you send us a copy of your resume and your latest grades?', datetime('now','-2 days'))`,
    app1, companyIds['TechNova Solutions']
  )
  run(
    `INSERT INTO messages (application_id, sender_id, sender_role, content, created_at) VALUES (?, ?, 'applicant', 'Good day! Attached are my resume and a copy of my TOR. Let me know if you need anything else.', datetime('now','-2 days'))`,
    app1, ap1.id
  )
  run(
    `INSERT INTO messages (application_id, sender_id, sender_role, content, created_at) VALUES (?, ?, 'company', 'Perfect, thank you! We will schedule an interview once the team finishes the review. Please keep your phone line open.', datetime('now','-1 day'))`,
    app1, companyIds['TechNova Solutions']
  )

  const app2 = run(
    `INSERT INTO applications (posting_id, applicant_id, cover_message, status, created_at, updated_at)
     VALUES (?, ?, ?, 'submitted', datetime('now','-5 hours'), datetime('now','-5 hours'))`,
    postingIds['Customer Service Trainee'], ap1.id,
    'Hi! I would like to apply for the Customer Service Trainee position. I am confident in my communication skills and can handle shifting schedules.'
  )
  run('INSERT INTO status_history (application_id, status, note) VALUES (?, ?, ?)', app2, 'submitted', 'Your application was submitted')

  // Accepted sample so school dashboard shows a "placed" student
  const app3 = run(
    `INSERT INTO applications (posting_id, applicant_id, cover_message, status, created_at, updated_at)
     VALUES (?, ?, ?, 'accepted', datetime('now','-10 days'), datetime('now','-2 days'))`,
    postingIds['Civil Engineering Assistant Intern'], ap2.id,
    'I am interested in site engineering and want to apply my drafting skills in a real project environment.'
  )
  for (const h of [
    ['submitted', 'Your application was submitted'],
    ['under_review', 'Application shortlisted by the engineering team'],
    ['interview', 'Interview conducted on site'],
    ['accepted', 'Congratulations! You are hired for the internship.']
  ]) {
    run('INSERT INTO status_history (application_id, status, note) VALUES (?, ?, ?)', app3, h[0], h[1])
  }

  // A resume for applicant@demo.com
  run(
    `INSERT INTO resumes (applicant_id, data) VALUES (?, ?)`,
    ap1.id,
    JSON.stringify({
      summary: 'Motivated BS Information Technology student seeking an OJT position where I can apply my IT troubleshooting and technical support skills while gaining hands-on experience in a professional IT environment.',
      skills: ['Networking Basics', 'Hardware Troubleshooting', 'Windows Server', 'SQL', 'Technical Support', 'Cybersecurity Fundamentals'],
      education: [{ school: 'University of the East', course: 'BS Information Technology', year: '2026' }],
      experience: [{ role: 'School ICT Assistant (Volunteer)', org: 'University of the East', years: '2024 – 2025', description: 'Assisted the campus ICT office with computer setup, network troubleshooting, and student account support.' }],
      projects: [{ name: 'Campus Lost & Found Portal', description: 'Built a web app for reporting and claiming lost items to the registrar office using HTML, CSS and PHP.' }],
      certifications: [{ name: 'Google IT Support Professional', year: '2025' }]
    })
  )

  console.log('\n  Seeded demo accounts (password: demo123)')
  console.log('  • school@demo.com       — school coordinator (University of the East)')
  console.log('  • applicant@demo.com    — BSIT applicant with applications + chat')
  console.log('  • applicant2@demo.com   — placed student (accepted)')
  console.log('  • applicant3@demo.com   — EE student, no applications yet')
  console.log('  • applicant4@demo.com   — Business student, no applications yet')
  console.log('  • company@demo.com      — TechNova Solutions\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})