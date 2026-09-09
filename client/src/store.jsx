import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './api'

const KEY = 'ojt_token'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(KEY))
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      let activeToken = localStorage.getItem(KEY)
      const params = new URLSearchParams(window.location.search)
      const oauthToken = params.get('token')
      if (oauthToken) {
        activeToken = oauthToken
        localStorage.setItem(KEY, oauthToken)
        setToken(oauthToken)
        params.delete('token')
        params.delete('error')
        const qs = params.toString()
        window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
      }
      if (!activeToken) {
        setReady(true)
        return
      }
      try {
        const u = await api('/auth/me', { token: activeToken })
        if (alive) setUser(u)
      } catch {
        localStorage.removeItem(KEY)
        if (alive) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (alive) setReady(true)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [token])

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } })
    localStorage.setItem(KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (payload) => {
    const data = await api('/auth/register', { method: 'POST', body: payload })
    localStorage.setItem(KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(KEY)
    setToken(null)
    setUser(null)
  }, [])

  const setProfile = useCallback((u) => setUser(u))

  return (
    <AuthContext.Provider value={{ token, user, ready, login, register, logout, setProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export function roleHome(role) {
  if (role === 'company') return '/company'
  if (role === 'school') return '/school'
  if (role === 'admin') return '/admin'
  return '/app'
}