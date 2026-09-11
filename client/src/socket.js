import { io } from 'socket.io-client'

let socket = null

export function getSocket(token) {
  if (!socket) {
    // Set VITE_SOCKET_URL to the backend URL when the frontend is hosted
    // separately from the backend (e.g. InfinityFree). Defaults to same-origin
    // ('/'), which works in development and when the server serves the app.
    const url = import.meta.env.VITE_SOCKET_URL || '/'
    socket = io(url, { auth: { token }, transports: ['websocket', 'polling'] })
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