import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PublicLayout } from '@/features/public/layout/PublicLayout'
import { HomePage } from '@/features/home/pages/HomePage'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

function encodeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

function stubAuthFetch(roles: string[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/verify')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: {
              user: {
                id: 'u1',
                name: 'Alice User',
                email: 'alice@example.com',
                roles,
                driverVerificationStatus: roles.includes('driver') ? 'VERIFIED' : null,
                agentVerificationStatus: roles.includes('agent') ? 'VERIFIED' : null,
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/notifications')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: { items: [], unreadCount: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/home')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: {
              featuredHouses: [],
              popularRecommended: [],
              verifiedAgents: [],
              partnerMovingServices: [],
              serviceReviews: [],
              newsUpdates: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ success: false, message: `Unhandled ${url}` }), {
        status: 404,
      })
    }),
  )
}

function renderLayout() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<HomePage />} />
      </Route>
    </Routes>,
  )
}

describe('driver jobs sub-header', () => {
  beforeEach(() => {
    tokenStorage.clear()
    const token = encodeJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'u1',
    })
    tokenStorage.setTokens(token, 'refresh-token', true)
  })

  it('shows Driver Jobs in sub-header for driver role and not in the profile menu', async () => {
    const user = userEvent.setup()
    stubAuthFetch(['driver'])
    renderLayout()

    await screen.findByRole('button', { name: /alice user/i })
    const subNav = screen.getByRole('navigation', { name: /sub/i })
    const jobsLink = subNav.querySelector('a[href="/driver/jobs"]')
    expect(jobsLink).not.toBeNull()
    expect(jobsLink).toHaveTextContent(/driver jobs/i)
    // Like the agent's listing button, it sits at the right end, outside the scrolling browse links.
    expect(jobsLink?.closest('.overflow-x-auto')).toBeNull()

    await user.click(screen.getByRole('button', { name: /alice user/i }))
    expect(screen.queryByRole('menuitem', { name: /driver jobs/i })).toBeNull()
  })

  it('hides Driver Jobs in sub-header for non-driver users', async () => {
    stubAuthFetch(['normal'])
    renderLayout()

    await screen.findByRole('button', { name: /alice user/i })
    const subNav = screen.getByRole('navigation', { name: /sub/i })
    expect(subNav.querySelector('a[href="/driver/jobs"]')).toBeNull()
    expect(screen.queryByRole('link', { name: /driver jobs/i })).toBeNull()
  })

  it('shows Driver Jobs and Post House Information when the user has both roles', async () => {
    stubAuthFetch(['agent', 'driver'])
    renderLayout()

    await screen.findByRole('button', { name: /alice user/i })
    const subNav = screen.getByRole('navigation', { name: /sub/i })
    expect(subNav.querySelector('a[href="/driver/jobs"]')).not.toBeNull()
    expect(subNav.querySelector('a[href="/agent/houses"]')).not.toBeNull()
  })
})
