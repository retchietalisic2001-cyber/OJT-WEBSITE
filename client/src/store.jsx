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
      if (!token) {
        setReady(true)
        return
      }
      try {
        const u = await api('/auth/me', { token })
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
  return '/app'
}