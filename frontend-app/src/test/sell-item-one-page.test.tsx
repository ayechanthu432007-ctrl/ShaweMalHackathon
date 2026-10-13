import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SellItemPage } from '@/features/marketplace/pages/SellItemPage'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

function createToken() {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-1' }))
  return `${btoa('{"alg":"none"}')}.${payload}.sig`
}

const routes: Record<string, unknown> = {
  '/auth/verify': { user: { id: 'user-1', name: 'Seller', email: 's@example.com', roles: ['normal'] } },
  '/marketplace/me/seller-status': {
    accountStatus: 'ACTIVE',
    contact: { phone: null, telegramUsername: null, viberNumber: null, showPhone: true, showTelegram: true, showViber: true },
  },
  '/marketplace/me/dashboard': { movingOutSales: [], listings: { items: [] } },
  '/marketplace/categories': { items: [{ id: 'cat1', name: 'Furniture', nameMy: null, slug: 'furniture', children: [] }] },
  '/master-data/cities': { items: [{ id: 'city1', name: 'Tamwe', stateId: 's1' }] },
}

describe('sell an item', () => {
  let posts: string[] = []

  beforeEach(() => {
    posts = []
    localStorage.clear()
    sessionStorage.clear()
    tokenStorage.setTokens(createToken(), 'refresh', true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (init?.method && init.method !== 'GET') posts.push(`${init.method} ${url}`)
        const match = Object.keys(routes).find((path) => url.includes(path))
        return match
          ? new Response(JSON.stringify({ success: true, message: 'ok', data: routes[match] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
          : new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows photos, item info, location and contact together on one page, with no steps', async () => {
    renderWithProviders(<SellItemPage />, { initialEntries: ['/marketplace/sell'] })

    expect(await screen.findByRole('heading', { name: 'Photos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Item info' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Location' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument()

    // Fields from every former step are on screen at once.
    expect(screen.getByRole('button', { name: 'Upload Photos' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Township')).toBeInTheDocument()
    expect(await screen.findByLabelText('Phone')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()
    expect(screen.queryByText(/step 1/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument()
  })

  it('checks the whole form when publishing and shows every problem at once', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SellItemPage />, { initialEntries: ['/marketplace/sell'] })

    await screen.findByLabelText('Phone')
    await user.click(screen.getByRole('button', { name: /publish/i }))

    expect(screen.getByText('Add at least one photo.')).toBeInTheDocument()
    expect(screen.getByText('Title must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('Choose a township.')).toBeInTheDocument()
    expect(screen.getByText('Please confirm the marketplace policy.')).toBeInTheDocument()
    expect(posts).toEqual([])
  })
})
