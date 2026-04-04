import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface UserInfo {
  id: number
  email: string
  name: string
}

interface AuthContextType {
  token: string | null
  user: UserInfo | null
  login: (token: string, user: UserInfo) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('jp_token'))
  const [user, setUser] = useState<UserInfo | null>(() => {
    const stored = localStorage.getItem('jp_user')
    return stored ? JSON.parse(stored) : null
  })

  const login = (newToken: string, newUser: UserInfo) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('jp_token', newToken)
    localStorage.setItem('jp_user', JSON.stringify(newUser))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('jp_token')
    localStorage.removeItem('jp_user')
  }

  useEffect(() => {
    if (!token) return
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!r.ok) logout() })
      .catch(() => logout())
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
