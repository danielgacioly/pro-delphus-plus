import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { UserDTO } from '@prodelphusplus/shared'
import { api, refreshAccessToken, setAccessToken } from '../lib/api'

interface AuthContextValue {
  user: UserDTO | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: UserDTO) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function restoreSession() {
      const token = await refreshAccessToken()
      if (token) {
        try {
          const { data } = await api.get<{ user: UserDTO }>('/auth/me')
          setUser(data.user)
        } catch {
          setUser(null)
        }
      }
      setLoading(false)
    }
    restoreSession()
  }, [])

  async function login(email: string, password: string) {
    const { data } = await api.post<{ accessToken: string; user: UserDTO }>('/auth/login', {
      email,
      password,
    })
    setAccessToken(data.accessToken)
    setUser(data.user)
  }

  async function logout() {
    await api.post('/auth/logout')
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
