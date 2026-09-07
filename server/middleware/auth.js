import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.JWT_SECRET || 'ojt-connect-dev-secret-change-me'

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    req.user = verifyToken(token)
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' })
    }
    next()
  }
}

export function attachSocketUser(socket, next) {
  try {
    const token = socket.handshake.auth?.token
    if (token) socket.user = verifyToken(token)
  } catch {
    socket.user = null
  }
  next()
}