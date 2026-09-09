import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads')

mkdirSync(DATA_DIR, { recursive: true })
mkdirSync(UPLOADS_DIR, { recursive: true })

export const DB_MODE = (process.env.DB_MODE || 'sqlite').toLowerCase()

export const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ojtconnect'
}

let db

if (DB_MODE === 'mysql') {
  const mysql = await import('mysql2/promise')
  db = await mysql.createPool({ ...DB_CONFIG, dateStrings: true })
  console.log(`\n  [db] MySQL connected → ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}\n`)
} else {
  const { DatabaseSync } = await import('node:sqlite')
  db = new DatabaseSync(path.join(DATA_DIR, 'ojt.db'))
  db.exec('PRAGMA foreign_keys = ON;')
}

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('school','applicant','company','admin')),
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  birthdate TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  logo TEXT NOT NULL DEFAULT '',
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
  student_id TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  search_city TEXT NOT NULL DEFAULT '',
  search_lat REAL,
  search_lng REAL
);

CREATE TABLE IF NOT EXISTS school_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS school_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES school_courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_id, course_id, name)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES school_courses(id) ON DELETE SET NULL,
  room_id INTEGER REFERENCES school_rooms(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_school ON enrollments(school_id);

CREATE TABLE IF NOT EXISTS company_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
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

CREATE TABLE IF NOT EXISTS account_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('company','school')),
  details TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','completed','approved','rejected')),
  file_name TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  file_mime TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  file2_name TEXT NOT NULL DEFAULT '',
  file2_path TEXT NOT NULL DEFAULT '',
  file2_mime TEXT NOT NULL DEFAULT '',
  file2_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('company','school')),
  document_type TEXT NOT NULL DEFAULT 'credentials',
  label TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  file_mime TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_postings_company ON postings(company_id);
CREATE INDEX IF NOT EXISTS idx_postings_status ON postings(status);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_posting ON applications(posting_id);
CREATE INDEX IF NOT EXISTS idx_messages_application ON messages(application_id);
CREATE INDEX IF NOT EXISTS idx_hist_application ON status_history(application_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users(username);
`

export async function initSchema() {
  if (DB_MODE === 'mysql') {
    const statements = [
      `SET FOREIGN_KEY_CHECKS = 0`,
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('school','applicant','company','admin') NOT NULL,
        phone VARCHAR(50) NOT NULL DEFAULT '',
        address VARCHAR(500) NOT NULL DEFAULT '',
        birthdate VARCHAR(10) NOT NULL DEFAULT '',
        gender VARCHAR(20) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS schools (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        logo VARCHAR(500) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS school_coordinators (
        user_id INT PRIMARY KEY,
        school_id INT NOT NULL,
        position VARCHAR(255) NOT NULL DEFAULT '',
        CONSTRAINT fk_sc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_sc_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS applicant_profiles (
        user_id INT PRIMARY KEY,
        school_id INT NULL,
        course VARCHAR(255) NOT NULL DEFAULT '',
        year_level VARCHAR(50) NOT NULL DEFAULT '',
        student_id VARCHAR(100) NOT NULL DEFAULT '',
        phone VARCHAR(50) NOT NULL DEFAULT '',
        search_city VARCHAR(255) NOT NULL DEFAULT '',
        search_lat DOUBLE NULL,
        search_lng DOUBLE NULL,
        CONSTRAINT fk_ap_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_ap_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS school_courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_sc_school (school_id, name),
        CONSTRAINT fk_sc_school2 FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS school_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        course_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_sr_course (school_id, course_id, name),
        CONSTRAINT fk_sr_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        CONSTRAINT fk_sr_course FOREIGN KEY (course_id) REFERENCES school_courses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS enrollments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        course_id INT NULL,
        room_id INT NULL,
        user_id INT NULL,
        student_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL DEFAULT '',
        status ENUM('invited','active') NOT NULL DEFAULT 'invited',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_enrollments_student (student_id),
        CONSTRAINT fk_enr_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        CONSTRAINT fk_enr_course FOREIGN KEY (course_id) REFERENCES school_courses(id) ON DELETE SET NULL,
        CONSTRAINT fk_enr_room FOREIGN KEY (room_id) REFERENCES school_rooms(id) ON DELETE SET NULL,
        CONSTRAINT fk_enr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS company_profiles (
        user_id INT PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL DEFAULT '',
        industry VARCHAR(255) NOT NULL DEFAULT '',
        description TEXT,
        address VARCHAR(500) NOT NULL DEFAULT '',
        logo VARCHAR(500) NOT NULL DEFAULT '',
        lat DOUBLE NULL,
        lng DOUBLE NULL,
        CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS postings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        requirements TEXT,
        course_tags VARCHAR(500) NOT NULL DEFAULT '',
        slots INT NOT NULL DEFAULT 1,
        city VARCHAR(255) NOT NULL DEFAULT '',
        address VARCHAR(500) NOT NULL DEFAULT '',
        lat DOUBLE NULL,
        lng DOUBLE NULL,
        status ENUM('open','closed') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_p_company FOREIGN KEY (company_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        posting_id INT NOT NULL,
        applicant_id INT NOT NULL,
        cover_message TEXT,
        status ENUM('submitted','under_review','interview','accepted','rejected','withdrawn') NOT NULL DEFAULT 'submitted',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_a_posting FOREIGN KEY (posting_id) REFERENCES postings(id) ON DELETE CASCADE,
        CONSTRAINT fk_a_applicant FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS status_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sh_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        sender_id INT NOT NULL,
        sender_role VARCHAR(50) NOT NULL,
        content TEXT,
        file_name VARCHAR(255) NULL,
        file_path VARCHAR(500) NULL,
        file_mime VARCHAR(150) NULL,
        file_size INT NULL,
        is_read TINYINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_m_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
        CONSTRAINT fk_m_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS resumes (
        applicant_id INT PRIMARY KEY,
        data LONGTEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_r_applicant FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS account_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kind ENUM('company','school') NOT NULL,
        details TEXT,
        status ENUM('pending','contacted','completed','approved','rejected') NOT NULL DEFAULT 'pending',
        file_name VARCHAR(255) NOT NULL DEFAULT '',
        file_path VARCHAR(500) NOT NULL DEFAULT '',
        file_mime VARCHAR(150) NOT NULL DEFAULT '',
        file_size INT NOT NULL DEFAULT 0,
        file2_name VARCHAR(255) NOT NULL DEFAULT '',
        file2_path VARCHAR(500) NOT NULL DEFAULT '',
        file2_mime VARCHAR(150) NOT NULL DEFAULT '',
        file2_size INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        kind ENUM('company','school') NOT NULL,
        document_type VARCHAR(50) NOT NULL DEFAULT 'credentials',
        label VARCHAR(255) NOT NULL DEFAULT '',
        file_name VARCHAR(255) NOT NULL DEFAULT '',
        file_path VARCHAR(500) NOT NULL DEFAULT '',
        file_mime VARCHAR(150) NOT NULL DEFAULT '',
        file_size INT NOT NULL DEFAULT 0,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        note VARCHAR(500) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL DEFAULT NULL,
        CONSTRAINT fk_v_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE INDEX idx_verifications_user ON verifications(user_id)`,
      `CREATE INDEX idx_postings_company ON postings(company_id)`,
      `CREATE INDEX idx_postings_status ON postings(status)`,
      `CREATE INDEX idx_applications_applicant ON applications(applicant_id)`,
      `CREATE INDEX idx_applications_posting ON applications(posting_id)`,
      `CREATE INDEX idx_messages_application ON messages(application_id)`,
      `CREATE INDEX idx_hist_application ON status_history(application_id)`,
      `SET FOREIGN_KEY_CHECKS = 1`
    ]
    for (const sql of statements) {
      try {
        await db.query(sql)
      } catch (err) {
        if (err?.code === 'ER_DUP_KEYNAME') continue
        throw err
      }
    }
  } else {
    db.exec(SQLITE_SCHEMA)
  }

  await migrateSchema()
}

const NEW_USER_COLUMNS = [
  ['username', 'VARCHAR(100) NULL', 'TEXT'],
  ['phone', "VARCHAR(50) NOT NULL DEFAULT ''", "TEXT NOT NULL DEFAULT ''"],
  ['address', "VARCHAR(500) NOT NULL DEFAULT ''", "TEXT NOT NULL DEFAULT ''"],
  ['birthdate', "VARCHAR(10) NOT NULL DEFAULT ''", "TEXT NOT NULL DEFAULT ''"],
  ['gender', "VARCHAR(20) NOT NULL DEFAULT ''", "TEXT NOT NULL DEFAULT ''"],
  ['is_verified', 'TINYINT(1) NOT NULL DEFAULT 0', 'INTEGER NOT NULL DEFAULT 0'],
  ['avatar', "VARCHAR(500) NOT NULL DEFAULT ''", "TEXT NOT NULL DEFAULT ''"]
]

async function migrateSchema() {
  if (DB_MODE === 'mysql') {
    for (const [col, mysqlDef] of NEW_USER_COLUMNS) {
      try {
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${mysqlDef}`)
      } catch (err) {
        if (err?.code === 'ER_DUP_FIELDNAME') continue
        throw err
      }
    }
    try {
      await db.query('CREATE UNIQUE INDEX uq_users_username ON users(username)')
    } catch (err) {
      if (err?.code !== 'ER_DUP_KEYNAME') throw err
    }
    try {
      await db.query(`ALTER TABLE users MODIFY COLUMN role ENUM('school','applicant','company','admin') NOT NULL`)
    } catch (err) {
      if (err?.code === 'ER_DUP_KEYNAME') return
      throw err
    }
    try {
      await db.query(`ALTER TABLE account_requests MODIFY COLUMN status ENUM('pending','contacted','completed','approved','rejected') NOT NULL DEFAULT 'pending'`)
    } catch (err) {
      if (err?.code === 'ER_DUP_FIELDNAME') return
      throw err
    }
    for (const table of ['company_profiles', 'schools']) {
      try {
        await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS logo VARCHAR(500) NOT NULL DEFAULT ''`)
      } catch (err) {
        if (err?.code === 'ER_DUP_FIELDNAME') continue
        throw err
      }
    }
    try {
      await db.query(`ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS student_id VARCHAR(100) NOT NULL DEFAULT ''`)
    } catch (err) {
      if (err?.code === 'ER_DUP_FIELDNAME') throw err
      if (err?.code === 'ER_DUP_KEYNAME') throw err
    }
    const REQ_FILE_COLUMNS = [
      ['file_name', "VARCHAR(255) NOT NULL DEFAULT ''"],
      ['file_path', "VARCHAR(500) NOT NULL DEFAULT ''"],
      ['file_mime', "VARCHAR(150) NOT NULL DEFAULT ''"],
      ['file_size', 'INT NOT NULL DEFAULT 0'],
      ['file2_name', "VARCHAR(255) NOT NULL DEFAULT ''"],
      ['file2_path', "VARCHAR(500) NOT NULL DEFAULT ''"],
      ['file2_mime', "VARCHAR(150) NOT NULL DEFAULT ''"],
      ['file2_size', 'INT NOT NULL DEFAULT 0']
    ]
    for (const [col, def] of REQ_FILE_COLUMNS) {
      try {
        await db.query(`ALTER TABLE account_requests ADD COLUMN ${col} ${def}`)
      } catch (err) {
        if (err?.code === 'ER_DUP_FIELDNAME') continue
        throw err
      }
    }
  } else {
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
    for (const [col, , sqliteDef] of NEW_USER_COLUMNS) {
      if (!cols.includes(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${sqliteDef}`)
    }
    const usersTable = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get() || {}).sql || ''
    if (!usersTable.includes('admin')) {
      db.exec('PRAGMA foreign_keys = OFF;')
      db.exec('ALTER TABLE users RENAME TO users_old;')
      db.exec(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        username TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('school','applicant','company','admin')),
        phone TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        birthdate TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT '',
        is_verified INTEGER NOT NULL DEFAULT 0,
        avatar TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`)
      db.exec(`INSERT INTO users (id, name, email, username, password_hash, role, phone, address, birthdate, gender, is_verified, avatar, created_at)
        SELECT id, name, email, username, password_hash, role, phone, address, birthdate, gender, is_verified, avatar, created_at FROM users_old;`)
      db.exec('DROP TABLE users_old;')
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users(username);')
      db.exec('PRAGMA foreign_keys = ON;')
    }
    const reqsTable = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'account_requests'").get() || {}).sql || ''
    if (reqsTable && !reqsTable.includes('approved')) {
      db.exec('PRAGMA foreign_keys = OFF;')
      db.exec('ALTER TABLE account_requests RENAME TO account_requests_old;')
      db.exec(`CREATE TABLE account_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('company','school')),
        details TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','completed','approved','rejected')),
        file_name TEXT NOT NULL DEFAULT '',
        file_path TEXT NOT NULL DEFAULT '',
        file_mime TEXT NOT NULL DEFAULT '',
        file_size INTEGER NOT NULL DEFAULT 0,
        file2_name TEXT NOT NULL DEFAULT '',
        file2_path TEXT NOT NULL DEFAULT '',
        file2_mime TEXT NOT NULL DEFAULT '',
        file2_size INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`)
      db.exec(`INSERT INTO account_requests (id, kind, details, status, created_at)
        SELECT id, kind, details, status, created_at FROM account_requests_old;`)
      db.exec('DROP TABLE account_requests_old;')
      db.exec('PRAGMA foreign_keys = ON;')
    }
const reqCols = db.prepare('PRAGMA table_info(account_requests)').all().map((c) => c.name)
    const REQ_FILE_COLS_SQLITE = [
      ['file_name', "TEXT NOT NULL DEFAULT ''"],
      ['file_path', "TEXT NOT NULL DEFAULT ''"],
      ['file_mime', "TEXT NOT NULL DEFAULT ''"],
      ['file_size', 'INTEGER NOT NULL DEFAULT 0'],
      ['file2_name', "TEXT NOT NULL DEFAULT ''"],
      ['file2_path', "TEXT NOT NULL DEFAULT ''"],
      ['file2_mime', "TEXT NOT NULL DEFAULT ''"],
      ['file2_size', 'INTEGER NOT NULL DEFAULT 0']
    ]
    for (const [col, def] of REQ_FILE_COLS_SQLITE) {
      if (!reqCols.includes(col)) db.exec(`ALTER TABLE account_requests ADD COLUMN ${col} ${def}`)
    }
    const apCols = db.prepare('PRAGMA table_info(applicant_profiles)').all().map((c) => c.name)
    if (!apCols.includes('student_id')) db.exec("ALTER TABLE applicant_profiles ADD COLUMN student_id TEXT NOT NULL DEFAULT ''")
    const cpCols = db.prepare('PRAGMA table_info(company_profiles)').all().map((c) => c.name)
    if (!cpCols.includes('logo')) db.exec("ALTER TABLE company_profiles ADD COLUMN logo TEXT NOT NULL DEFAULT ''")
    const schCols = db.prepare('PRAGMA table_info(schools)').all().map((c) => c.name)
    if (!schCols.includes('logo')) db.exec("ALTER TABLE schools ADD COLUMN logo TEXT NOT NULL DEFAULT ''")

  }
  if (DB_MODE === 'mysql') {
    await db.query("UPDATE users SET is_verified = 1 WHERE role IN ('company','school')")
  } else {
    db.exec("UPDATE users SET is_verified = 1 WHERE role IN ('company','school')")
  }
}
export async function run(sql, ...params) {
  if (DB_MODE === 'mysql') {
    const [result] = await db.query(sql, params)
    return Number(result.insertId)
  }
  const stmt = db.prepare(sql)
  const result = stmt.run(...params)
  return Number(result.lastInsertRowid)
}

export async function get(sql, ...params) {
  if (DB_MODE === 'mysql') {
    const [rows] = await db.query(sql, params)
    return rows[0] ?? null
  }
  return db.prepare(sql).get(...params)
}

export async function all(sql, ...params) {
  if (DB_MODE === 'mysql') {
    const [rows] = await db.query(sql, params)
    return rows
  }
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
  'Mechanical Engineering',
  'Electronics Engineering',
  'Industrial Engineering',
  'Chemical Engineering',
  'Business Administration',
  'Accountancy',
  'Marketing Management',
  'Human Resource Management',
  'Office Administration',
  'Multimedia Arts',
  'Architecture',
  'Nursing',
  'Pharmacy',
  'Education',
  'Elementary Education',
  'Secondary Education',
  'Tourism Management',
  'Hospitality Management',
  'Criminology',
  'Psychology',
  'Political Science',
  'Sociology',
  'Biology',
  'Chemistry',
  'Physics',
  'Mathematics',
  'Communication Arts',
  'Journalism',
  'Public Administration',
  'Economics',
  'International Studies'
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

// Compatibility: expose `db` for direct prepare() usage (SQLite path only).
// Prefer run/get/all helpers instead.
export { db }
