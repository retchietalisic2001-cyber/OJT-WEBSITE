import { run } from '../db.js'

export async function createNotification({ userId, type = 'general', title = '', body = '', link = '', io }) {
  if (!userId) return null
  const id = await run(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)`,
    userId,
    type,
    title,
    body,
    link || ''
  )
  const payload = {
    id,
    type,
    title,
    body,
    link,
    is_read: 0,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
  }
  if (io) {
    io.to(`user-${userId}`).emit('notifications:new', payload)
  }
  return payload
}

export async function notifyMany({ userIds = [], ...opts }) {
  const out = []
  for (const uid of [...new Set(userIds)]) {
    if (uid && Number.isFinite(Number(uid))) {
      out.push(await createNotification({ userId: Number(uid), ...opts }))
    }
  }
  return out
}