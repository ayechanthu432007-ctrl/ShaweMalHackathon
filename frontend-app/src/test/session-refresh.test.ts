import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiRequestError, apiRequest, setUnauthorizedHandler } from '@/lib/api/client'
import { tokenStorage } from '@/lib/auth/token-storage'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('session renewal', () => {
  const onUnauthorized = vi.fn()

  beforeEach(() => {
    tokenStorage.clear()
    onUnauthorized.mockReset()
    setUnauthorizedHandler(onUnauthorized)
  })

  it('renews an expired access token once and repeats the request', async () => {
    tokenStorage.setTokens('expired-token', 'refresh-1', true)
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const auth = new Headers(init?.headers).get('Authorization')
        calls.push(`${url.split('/api/v1')[1]} ${auth ?? ''}`.trim())
        if (url.endsWith('/auth/refresh')) return json(200, { success: true, message: 'ok', data: { accessToken: 'fresh-token', refreshToken: 'refresh-2' } })
        return auth === 'Bearer fresh-token' ? json(200, { success: true, message: 'ok', data: { value: 1 } }) : json(401, { success: false, message: 'expired' })
      }),
    )

    // Two requests at once must share a single refresh, because the server rotates the token.
    const [first, second] = await Promise.all([apiRequest<{ value: number }>('/profile'), apiRequest<{ value: number }>('/notifications')])

    expect(first.value).toBe(1)
    expect(second.value).toBe(1)
    expect(calls.filter((call) => call.startsWith('/auth/refresh'))).toHaveLength(1)
    expect(tokenStorage.getAccessToken()).toBe('fresh-token')
    expect(tokenStorage.getRefreshToken()).toBe('refresh-2')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('ends the session when the refresh token is rejected too', async () => {
    tokenStorage.setTokens('expired-token', 'revoked-refresh', true)
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { success: false, message: 'nope' })))

    await expect(apiRequest('/profile')).rejects.toBeInstanceOf(ApiRequestError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not treat a wrong password on sign-in as a lost session', async () => {
    const fetchMock = vi.fn(async () => json(401, { success: false, message: 'Invalid email or password.' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/auth/login', { method: 'POST', body: { email: 'a@b.co', password: 'x' }, auth: false })).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
