import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { authApi } from '@/features/auth/api/auth-api'
import type { AuthUser, LoginInput, RegisterInput } from '@/features/auth/types'
import { refreshAccessToken } from '@/lib/api/client'
import { setUnauthorizedHandler } from '@/lib/api/interceptors'
import { isJwtExpired } from '@/lib/auth/jwt'
import { tokenStorage } from '@/lib/auth/token-storage'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  login: (input: LoginInput) => Promise<AuthUser | null>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const [hasToken, setHasToken] = useState(() => Boolean(tokenStorage.getAccessToken()))

  const clearSession = useCallback(() => {
    tokenStorage.clear()
    setHasToken(false)
    queryClient.setQueryData(['auth', 'me'], null)
  }, [queryClient])

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    enabled: hasToken,
    queryFn: async () => {
      const token = tokenStorage.getAccessToken()
      // An expired access token is renewed with the refresh token before giving up on the session.
      if (!token || (isJwtExpired(token) && !(await refreshAccessToken()))) {
        clearSession()
        throw new Error('TOKEN_EXPIRED')
      }
      const result = await authApi.verify()
      return result.user
    },
    retry: false,
  })

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
    })
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await authApi.login(input)
      tokenStorage.setTokens(result.accessToken, result.refreshToken, input.rememberMe ?? true)
      setHasToken(true)
      const user = result.user ?? (await authApi.verify()).user
      queryClient.setQueryData(['auth', 'me'], user)
      return user
    },
    [queryClient],
  )

  const register = useCallback(async (input: RegisterInput) => {
    await authApi.register(input)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken()
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken)
      } catch {
        // Ignore logout network errors; local session still clears.
      }
    }
    clearSession()
    // Drop everything fetched for this account, so the next person to sign in on this
    // browser never sees the previous user's listings, orders or plan, even for a moment.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' })
  }, [clearSession, queryClient])

  const refreshSession = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken()
    if (!refreshToken) {
      clearSession()
      return false
    }

    try {
      const rememberMe = Boolean(localStorage.getItem('shwemal.accessToken'))
      const result = await authApi.refresh(refreshToken)
      tokenStorage.setTokens(result.accessToken, result.refreshToken ?? refreshToken, rememberMe)
      setHasToken(true)
      await meQuery.refetch()
      return true
    } catch {
      clearSession()
      return false
    }
  }, [clearSession, meQuery])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isAuthenticated: Boolean(meQuery.data),
      isBootstrapping: hasToken && meQuery.isLoading,
      login,
      register,
      logout,
      refreshSession,
    }),
    [hasToken, login, logout, meQuery.data, meQuery.isLoading, refreshSession, register],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
