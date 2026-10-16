import { screen } from '@testing-library/react'
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

describe('agent post housing sub-header', () => {
  beforeEach(() => {
    tokenStorage.clear()
    const token = encodeJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'u1',
    })
    tokenStorage.setTokens(token, 'refresh-token', true)
  })

  it('shows Post Housing Information in sub-header for agent role', async () => {
    stubAuthFetch(['agent'])
    renderLayout()

    await screen.findByRole('button', { name: /alice user/i })
    const subNav = screen.getByRole('navigation', { name: /sub/i })
    const postLink = subNav.querySelector('a[href="/agent/houses"]')
    expect(postLink).not.toBeNull()
    expect(postLink).toHaveTextContent(/listing dashboard/i)
  })

  it('uses the short second-row names', async () => {
    stubAuthFetch(['agent'])
    renderLayout()

    await screen.findByRole('button', { name: /alice user/i })
    const subNav = screen.getByRole('navigation', { name: /sub/i })
    const names = [...subNav.querySelectorAll('a')].map((link) => link.getAttribute('aria-label') ?? link.textContent)
    expect(names).toEqual(['Housing', 'Moving', 'Track Move', 'Roommates', 'Marketplace', 'Listing Dashboard'])
  })

  it('places the agent action at the right end, apart from the scrolling browse links', async () => {
    stubAuthFetch(['agent'])
    renderLayout()

    await screen.findByRole('button', { name: /alice user/i })
    const subNav = screen.getByRole('navigation', { name: /sub/i })
    const postLink = screen.getByRole('link', { name: 'Listing Dashboard' })
    const row = postLink.parentElement as HTMLElement
    // Last item of the row, and not inside the group of browse links that scrolls on phones.
    expect(row.lastElementChild).toBe(postLink)
    const browseLinks = subNav.querySelector('a[href="/finding-house"]')?.parentElement as HTMLElement
    expect(browseLinks.contains(postLink)).toBe(false)
    expect(browseLinks.className).toContain('overflow-x-auto')
  })

  it('hides Post Housing Information in sub-header for non-agent users', async () => {
    stubAuthFetch(['normal'])
    renderLayout()

    await screen.findByRole('button', { name: /alice user/i })
    const subNav = screen.getByRole('navigation', { name: /sub/i })
    expect(subNav.querySelector('a[href="/agent/houses"]')).toBeNull()
    expect(screen.queryByRole('link', { name: /listing dashboard/i })).toBeNull()
  })
})
