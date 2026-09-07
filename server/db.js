import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const DATA_DIR = path.join(__dirname, '..', 'data')
export const UPLOADS_DIR = path.join(__dirname, 'uploads')

mkdirSync(DATA_DIR, { recursive: true })
mkdirSync(UPLOADS_DIR, { recursive: true })

export const db = new DatabaseSync(path.join(DATA_DIR, 'ojt.db'))

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('school','applicant','company')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS school_coordinators (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  position TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS applicant_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  course TEXT NOT NULL DEFAULT '',
  year_level TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  search_city TEXT NOT NULL DEFAULT '',
  search_lat REAL,
  search_lng REAL
);

CREATE TABLE IF NOT EXISTS company_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL
);

CREATE TABLE IF NOT EXISTS postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '',
  course_tags TEXT NOT NULL DEFAULT '',
  slots INTEGER NOT NULL DEFAULT 1,
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  posting_id INTEGER NOT NULL REFERENCES postings(id) ON DELETE CASCADE,
  applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','interview','accepted','rejected','withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  file_name TEXT,
  file_path TEXT,
  file_mime TEXT,
  file_size INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resumes (
  applicant_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_postings_company ON postings(company_id);
CREATE INDEX IF NOT EXISTS idx_postings_status ON postings(status);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_posting ON applications(posting_id);
CREATE INDEX IF NOT EXISTS idx_messages_application ON messages(application_id);
CREATE INDEX IF NOT EXISTS idx_hist_application ON status_history(application_id);
`

db.exec('PRAGMA foreign_keys = ON;')
db.exec(SCHEMA)

export function run(sql, ...params) {
  const stmt = db.prepare(sql)
  const result = stmt.run(...params)
  return Number(result.lastInsertRowid)
}

export function get(sql, ...params) {
  return db.prepare(sql).get(...params)
}

export function all(sql, ...params) {
  return db.prepare(sql).all(...params)
}

export function nowTs() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export const COURSES = [
  'Information Technology',
  'Computer Science',
  'Civil Engineering',
  'Electrical Engineering',
  'Business Administration',
  'Accountancy',
  'Multimedia Arts'
]

export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']

export const APPLICATION_STATUSES = [
  'submitted',
  'under_review',
  'interview',
  'accepted',
  'rejected',
  'withdrawn'
]

export const STATUS_META = {
  submitted: { label: 'Submitted', color: '#5B4BDB' },
  under_review: { label: 'Under Review', color: '#2F80ED' },
  interview: { label: 'Interview', color: '#F0A03C' },
  accepted: { label: 'Accepted', color: '#2FA86B' },
  rejected: { label: 'Rejected', color: '#E5484D' },
  withdrawn: { label: 'Withdrawn', color: '#8A8FA3' }
}