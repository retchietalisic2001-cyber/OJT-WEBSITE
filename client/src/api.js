// Base URL for API requests. Set VITE_API_URL when the frontend is hosted
// somewhere other than the backend (e.g. InfinityFree static hosting) so calls
// go to the Render backend instead of the same origin. Example:
//   VITE_API_URL=https://ojt-connect.onrender.com
const API = import.meta.env.VITE_API_URL || '/api'

export async function api(path, { method = 'GET', body, token, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) {
    payload = form
  } else if (body != null) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(API + path, { method, headers, body: payload })
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed')
    err.status = res.status
    throw err
  }
  return data
}

export const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(String(iso).replace(' ', 'T'))
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const fmtDateTime = (iso) => {
  if (!iso) return ''
  const d = new Date(String(iso).replace(' ', 'T'))
  if (isNaN(d)) return iso
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export const schoolName = (user) => user?.profile?.school_name || user?.school_name || schoolOf(user)
export const schoolOf = (user) => user?.profile?.school_name || ''

export function tagColor(i) {
  const palette = ['#5B4BDB', '#2F80ED', '#0EA5A4', '#D97706', '#DB4B8B', '#3B82A0']
  return palette[i % palette.length]
}