import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import passport from 'passport'
import { UPLOADS_DIR, get, initSchema } from './db.js'
import { attachSocketUser } from './middleware/auth.js'

import authRoutes from './routes/auth.js'
import socialRoutes from './routes/social.js'
import adminRoutes from './routes/admin.js'
import schoolsRoutes from './routes/schools.js'
import postingsRoutes from './routes/postings.js'
import applicationsRoutes from './routes/applications.js'
import messagesRoutes from './routes/messages.js'
import resumeRoutes from './routes/resume.js'
import recommendationsRoutes from './routes/recommendations.js'
import supportRoutes from './routes/support.js'
import verifyRoutes from './routes/verify.js'
import { adminSockets } from './presence.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(passport.initialize())
app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: true, maxAge: '1h' }))

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'ojt-connect-api' }))
app.use('/api/auth', authRoutes)
app.use('/api/auth', socialRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/schools', schoolsRoutes)
app.use('/api/postings', postingsRoutes)
app.use('/api/applications', applicationsRoutes)
app.use('/api/messages', messagesRoutes)
app.use('/api/resume', resumeRoutes)
app.use('/api/recommendations', recommendationsRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/verify', verifyRoutes)

// Serve built client (after `npm --prefix client run build`).
const distDir = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

// Socket.IO — realtime chat
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } })
app.set('io', io)

io.use(attachSocketUser)
io.use(async (socket, next) => {
  if (!socket.user) return next(new Error('Unauthorized'))
  try {
    const user = await get('SELECT id, role FROM users WHERE id = ?', socket.user.id)
    if (!user) return next(new Error('Unauthorized'))
    socket.user = user
    next()
  } catch {
    return next(new Error('Unauthorized'))
  }
})

io.on('connection', (socket) => {
  socket.on('presence', ({ role }) => {
    if (role === 'admin' && socket.user?.role === 'admin') {
      adminSockets.add(socket.id)
    }
  })

  socket.on('disconnect', () => {
    adminSockets.delete(socket.id)
  })

  socket.on('join', async (applicationId) => {
    try {
      const ctx = await get(
        `SELECT a.id, a.applicant_id, p.company_id FROM applications a JOIN postings p ON p.id = a.posting_id WHERE a.id = ?`,
        Number(applicationId)
      )
      const ok =
        ctx &&
        (ctx.applicant_id === socket.user.id ||
          (socket.user.role === 'company' && ctx.company_id === socket.user.id))
      if (ok) {
        socket.join(`app-${ctx.id}`)
        socket.emit('joined', { applicationId: ctx.id })
      } else {
        socket.emit('join-error', { message: 'No access to this conversation' })
      }
    } catch {
      socket.emit('join-error', { message: 'Error joining conversation' })
    }
  })

  socket.on('typing', ({ applicationId, sender }) => {
    if (!applicationId) return
    socket.to(`app-${applicationId}`).emit('typing', { applicationId, sender })
  })
})

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File must be 10 MB or smaller' })
  if (err && err.message) return res.status(400).json({ error: err.message })
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
})

server.listen(PORT, async () => {
  try {
    await initSchema()
    const { seedDatabase, ensureAdmin } = await import('./seed.js')
    if (process.env.SEED_ON_START === 'true') {
      const count = await get('SELECT COUNT(*) AS c FROM users')
      if (!count || Number(count.c) === 0) {
        await seedDatabase()
      }
    }
    await ensureAdmin()
    console.log(`\n  OJT Connect API running → http://localhost:${PORT}\n`)
  } catch (err) {
    console.error('\n  Failed to initialize database:', err.message)
    process.exit(1)
  }
})