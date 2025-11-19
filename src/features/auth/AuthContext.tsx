import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type LoginPayload, type SanitizedUser } from '../../api/authApi'
import { setAccessTokenGetter } from '../../api/apiClient'

type AuthState = {
  user: SanitizedUser | null
  accessToken: string | null
  isLoading: boolean
}

type AuthContextValue = AuthState & {
  login: (payload: LoginPayload) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const TOKEN_STORAGE_KEY = 'schoolman.accessToken'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SanitizedUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    const restoreSession = async () => {
      const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY)
      if (!storedToken) {
        setIsLoading(false)
        return
      }

      setAccessToken(storedToken)
      try {
        const currentUser = await authApi.me()
        if (!isCancelled) {
          setUser(currentUser)
        }
      } catch {
        if (!isCancelled) {
          setAccessToken(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    restoreSession()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    setAccessTokenGetter(() => accessToken)
    if (accessToken) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken)
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  }, [accessToken])

  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true)
    try {
      const data = await authApi.login(payload)
      setAccessToken(data.accessToken)
      setUser(data.user)
    } catch (error) {
      setUser(null)
      setAccessToken(null)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setAccessToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!accessToken) {
      setUser(null)
      return
    }

    setIsLoading(true)
    try {
      const currentUser = await authApi.me()
      setUser(currentUser)
    } catch (error) {
      setAccessToken(null)
      setUser(null)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, accessToken, isLoading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
