import { io } from 'socket.io-client'

let socket = null

export function getSocket(token) {
  if (!socket) {
    socket = io('/', { auth: { token }, transports: ['websocket', 'polling'] })
  }
  return socket
}

export function closeSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function startAdminPresence(token) {
  const s = getSocket(token)
  const ping = () => s.emit('presence', { role: 'admin' })
  ping()
  s.off('connect', ping)
  s.on('connect', ping)
  return s
}