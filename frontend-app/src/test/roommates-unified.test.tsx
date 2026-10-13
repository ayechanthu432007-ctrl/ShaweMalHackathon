import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FindingRoommatesPage } from '@/features/roommates/pages/FindingRoommatesPage'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

function createToken() {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'me' }))
  return `${btoa('{"alg":"none"}')}.${payload}.sig`
}

const post = (id: string, name: string, match: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Post by ${name}`,
  budgetCostSharing: '150,000 MMK',
  gender: 'FEMALE',
  occupation: { id: 'occ1', name: 'Student' },
  preferences: { isNoSmoking: true },
  hobbies: { hobbyReading: true },
  photos: [],
  user: { id: `user-${id}`, name, phone: '09 111 222', profilePicturePath: null },
  house: { id: 'h1', title: 'Shared flat', city: { id: 'c1', name: 'Tamwe' }, state: { id: 's1', name: 'Yangon' } },
  match,
  ...extra,
})

const scored = (score: number, extra: Record<string, unknown> = {}) => ({ score, confidence: 'HIGH', matched: ['budget', 'smoking'], conflicts: [], missing: ['sleep'], ...extra })

let listCalls: string[] = []

function stub(list: unknown, signedIn: boolean) {
  const json = (data: unknown) => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/verify')) return json({ user: { id: 'me', name: 'Thiri', email: 't@example.com', roles: ['normal'] } })
      if (url.includes('/master-data/')) return json({ items: [] })
      if (url.includes('/roommates')) {
        listCalls.push(new Headers(init?.headers).get('Authorization') ? 'with session' : 'anonymous')
        return json(list)
      }
      return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
    }),
  )
  if (signedIn) tokenStorage.setTokens(createToken(), 'refresh', true)
}

describe('unified roommate list', () => {
  beforeEach(() => {
    listCalls = []
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows every post once in a single section, with the personal match on each card, in the ranked order', async () => {
    stub(
      {
        items: [post('a', 'Aung', scored(95)), post('b', 'Bo Bo', scored(70, { conflicts: ['social'] })), post('mine', 'Thiri', null, { user: { id: 'me', name: 'Thiri', phone: '09 000', profilePicturePath: null } })],
        viewer: { signedIn: true, hasPreferences: true },
      },
      true,
    )
    renderWithProviders(<FindingRoommatesPage />, { initialEntries: ['/finding-roommates'] })

    expect(await screen.findByRole('heading', { name: 'Find Your Best Roommate' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /best roommate matches for you/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /all roommate posts/i })).not.toBeInTheDocument()

    await screen.findByText('Your post')
    const cards = screen.getAllByRole('listitem').filter((item) => within(item).queryByRole('button', { name: 'View Profile' }))
    expect(cards.map((card) => within(card).getByText(/^(Aung|Bo Bo|Thiri)$/).textContent)).toEqual(['Aung', 'Bo Bo', 'Thiri'])
    expect(screen.getAllByText('Aung')).toHaveLength(1)

    const first = cards[0] as HTMLElement
    expect(within(first).getByText('95% match')).toBeInTheDocument()
    expect(within(first).getByText('Female')).toBeInTheDocument()
    expect(within(first).getByText('Student')).toBeInTheDocument()
    expect(within(first).getByText('Tamwe, Yangon')).toBeInTheDocument()
    expect(within(first).getByText('150,000 MMK')).toBeInTheDocument()
    expect(within(first).getByRole('link', { name: 'Contact Aung' })).toHaveAttribute('href', 'tel:09111222')
    expect(within(cards[1] as HTMLElement).getByText('70% match')).toBeInTheDocument()

    // One's own post is listed too, without a match against oneself.
    const mine = cards[2] as HTMLElement
    expect(within(mine).getByText('Your post')).toBeInTheDocument()
    expect(within(mine).queryByText(/% match/)).not.toBeInTheDocument()

    await userEvent.setup().click(within(first).getByRole('button', { name: 'View Profile' }))
    expect(within(first).getByText('Home: Shared flat')).toBeInTheDocument()
    expect(listCalls).toEqual(['with session'])
  })

  it('asks for preferences instead of showing 0% when the visitor has not saved any', async () => {
    stub({ items: [post('a', 'Aung', { score: 0, confidence: 'INCOMPLETE', matched: [], conflicts: [], missing: ['budget'] })], viewer: { signedIn: true, hasPreferences: false } }, true)
    renderWithProviders(<FindingRoommatesPage />, { initialEntries: ['/finding-roommates'] })

    expect((await screen.findAllByText(/complete your preferences to see your match/i)).length).toBeGreaterThan(0)
    expect(screen.getByText('Aung')).toBeInTheDocument()
    expect(screen.queryByText(/0% match/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Set preferences' })[0]).toHaveAttribute('href', '/profile#housing-preferences')
  })

  it('shows guests the same posts without matches, and invites them to sign in', async () => {
    stub({ items: [post('a', 'Aung', null)], viewer: { signedIn: false, hasPreferences: false } }, false)
    renderWithProviders(<FindingRoommatesPage />, { initialEntries: ['/finding-roommates'] })

    expect(await screen.findByText('Aung')).toBeInTheDocument()
    expect(screen.queryByText(/% match/)).not.toBeInTheDocument()
    expect(screen.getByText(/sign in to see the roommates most compatible with you/i)).toBeInTheDocument()
  })
})
