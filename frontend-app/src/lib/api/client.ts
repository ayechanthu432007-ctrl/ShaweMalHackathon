import { tokenStorage } from '@/lib/auth/token-storage'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'

export type ApiSuccess<T> = {
  success: true
  message: string
  data: T
}

export type ApiFailure = {
  success: false
  message: string
  code?: string
  errors?: unknown
}

export class ApiRequestError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: boolean
}

let refreshInFlight: Promise<boolean> | null = null

/**
 * Exchanges the stored refresh token for a new pair. The server replaces the refresh token
 * on every use, so concurrent callers share one request instead of racing each other.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight

  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) return Promise.resolve(false)

  // Keep the session where the user chose to keep it ("Remember me" = localStorage).
  const rememberMe = Boolean(localStorage.getItem('shwemal.refreshToken'))
  refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as ApiSuccess<{ accessToken: string; refreshToken?: string }> | null
      if (!response.ok || !payload?.data?.accessToken) return false
      tokenStorage.setTokens(payload.data.accessToken, payload.data.refreshToken ?? refreshToken, rememberMe)
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  // Let the browser set multipart boundary for FormData; do not JSON.stringify it.
  if (!headers.has('Content-Type') && options.body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }

  const usesSession = options.auth !== false
  const send = () => {
    const token = usesSession ? tokenStorage.getAccessToken() : null
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body:
        options.body === undefined
          ? undefined
          : isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    })
  }

  let response = await send()

  // Access tokens are short-lived. When one has expired, get a new one with the refresh
  // token and repeat the request once, so the user is not signed out mid-task.
  if (response.status === 401 && usesSession && tokenStorage.getAccessToken() && (await refreshAccessToken())) {
    response = await send()
  }

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null

  if (!response.ok) {
    // Only a rejected session ends the session; a wrong password on the sign-in form does not.
    if (response.status === 401 && usesSession) {
      unauthorizedHandler?.()
    }

    const message =
      payload && 'message' in payload && payload.message
        ? payload.message
        : `Request failed with status ${response.status}`
    // The API reports its error code under `errors.code`.
    const nested = payload && 'errors' in payload && payload.errors && typeof payload.errors === 'object' ? (payload.errors as { code?: unknown }).code : undefined
    const code = payload && 'code' in payload && payload.code ? payload.code : typeof nested === 'string' ? nested : undefined
    throw new ApiRequestError(message, response.status, code, payload)
  }

  if (payload && 'data' in payload) {
    return payload.data
  }

  return payload as T
}
