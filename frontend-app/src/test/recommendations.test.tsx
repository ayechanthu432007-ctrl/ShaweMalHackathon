import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SignUpPage } from '@/features/auth/pages/SignUpPage'
import { RecommendedHouses } from '@/features/recommendations/components/RecommendedHouses'
import { RecommendedRoommates } from '@/features/recommendations/components/RecommendedRoommates'
import { TenantCompatibility } from '@/features/recommendations/components/TenantCompatibility'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

function createToken() {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-1' }))
  return `${header}.${payload}.sig`
}

const match = (score: number, extra: Record<string, unknown> = {}) => ({
  score,
  confidence: 'HIGH',
  matched: ['budget', 'location'],
  conflicts: [],
  missing: [],
  ...extra,
})

const houses = {
  userName: 'Thiri',
  hasPreferences: true,
  hasOccupation: true,
  items: [
    {
      house: { id: 'h1', title: 'Bright Condo', monthlyFees: 300000, bedrooms: 2, bathrooms: 1, propertyType: { id: 'p', name: 'Condo' }, city: { id: 'c', name: 'Yangon' }, state: null, thumbnail: null, amenities: ['WIFI', 'DESK'] },
      match: match(92),
    },
    {
      house: { id: 'h2', title: 'Quiet Studio', monthlyFees: 250000, bedrooms: 1, bathrooms: 1, propertyType: null, city: { id: 'c', name: 'Yangon' }, state: null, thumbnail: null, amenities: [] },
      match: match(61, { confidence: 'LOW', matched: ['budget'], conflicts: ['room'] }),
    },
  ],
}

const roommates = {
  userName: 'Thiri',
  hasPreferences: true,
  total: 1,
  page: 1,
  pageSize: 6,
  items: [
    {
      post: { id: 'r1', title: 'Looking for a flatmate', budgetCostSharing: '150,000 MMK', gender: 'ANY', occupation: { id: 'o', name: 'Student' }, photos: [], user: { id: 'u2', name: 'Aung', phone: '09 111 222', profilePicturePath: null }, house: { id: 'h', title: 'Shared flat', city: { id: 'c', name: 'Yangon' }, state: null } },
      match: match(88, { matched: ['smoking', 'social', 'budget', 'location'] }),
    },
  ],
}

const tenants = {
  total: 1,
  page: 1,
  pageSize: 5,
  items: [
    {
      user: { id: 'u3', name: 'Su Su', profilePicturePath: null, occupation: 'Remote Worker' },
      lookingFor: { preferredCity: 'Yangon', budgetMin: null, budgetMax: 350000, bedroomsMin: 2, propertyType: null, moveInDate: null, leaseMonths: 6 },
      match: match(84, { conflicts: ['amenities'], missing: ['occupation'] }),
    },
  ],
}

let requests: Array<{ url: string; method: string; body: unknown }> = []

function stubFetch(signedIn: boolean) {
  const json = (data: unknown) => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null })
      if (url.includes('/auth/verify')) return json({ user: { id: 'user-1', name: 'Thiri', email: 't@example.com', roles: ['normal'] } })
      if (url.includes('/master-data/occupations')) return json({ items: [{ id: 'occ-student', name: 'Student' }, { id: 'occ-remote', name: 'Remote Worker' }] })
      if (url.includes('/recommendations/houses')) return json(houses)
      if (url.includes('/recommendations/roommates')) return json(roommates)
      if (url.includes('/agent/houses/tenant-matches')) return json(tenants)
      if (url.includes('/auth/register')) return json({ user: { id: 'new' }, accessToken: 'a', refreshToken: 'r' })
      return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
    }),
  )
  if (signedIn) tokenStorage.setTokens(createToken(), 'refresh', true)
}

describe('recommendations', () => {
  beforeEach(() => {
    requests = []
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('asks a signed-out visitor to sign in instead of showing made-up houses', async () => {
    stubFetch(false)
    renderWithProviders(<RecommendedHouses />)

    expect(await screen.findByRole('heading', { name: 'Recommended Houses for You' })).toBeInTheDocument()
    expect(screen.getByText(/sign in to see houses matched/i)).toBeInTheDocument()
    expect(requests.some((request) => request.url.includes('/recommendations/'))).toBe(false)
  })

  it('shows the recommended houses for the signed-in person with score, reason and details link', async () => {
    stubFetch(true)
    renderWithProviders(<RecommendedHouses />)

    expect(await screen.findByRole('heading', { name: 'Recommended Houses for Thiri' })).toBeInTheDocument()
    const cards = await screen.findAllByRole('listitem')
    const first = cards.find((card) => within(card).queryByText('Bright Condo'))!
    expect(within(first).getByText('92% match')).toBeInTheDocument()
    expect(within(first).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '92')
    expect(within(first).getByText('Recommended because it fits your budget, location.')).toBeInTheDocument()
    expect(within(first).getByText('WIFI · DESK')).toBeInTheDocument()
    expect(within(first).getByRole('link', { name: 'View Details' })).toHaveAttribute('href', '/houses/h1')

    const second = cards.find((card) => within(card).queryByText('Quiet Studio'))!
    expect(within(second).getByText('Low confidence')).toBeInTheDocument()
    expect(within(second).getByText('room type and size')).toBeInTheDocument()
  })

  it('lists the best roommate matches with their top three factors and a contact action', async () => {
    stubFetch(true)
    renderWithProviders(<RecommendedRoommates />)

    expect(await screen.findByRole('heading', { name: 'Best Roommate Matches for You' })).toBeInTheDocument()
    expect(await screen.findByText('Aung')).toBeInTheDocument()
    expect(screen.getByText('88% match')).toBeInTheDocument()
    expect(screen.getByText('You match on smoking preference, social lifestyle, budget.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', 'tel:09111222')

    await userEvent.setup().click(screen.getByRole('button', { name: 'View Profile' }))
    expect(screen.getByText('Looking for a flatmate')).toBeInTheDocument()
  })

  it('analyses a listing draft for the agent and shows matches, conflicts and a limited profile', async () => {
    stubFetch(true)
    renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 300000, cityId: 'c1', bedrooms: 2, amenityIds: [] }} />)

    expect(screen.getByRole('heading', { name: 'Potential Tenant Compatibility' })).toBeInTheDocument()
    expect(await screen.findByText('Su Su', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('84% match')).toBeInTheDocument()
    expect(screen.getByText('Remote Worker')).toBeInTheDocument()
    expect(screen.getByText('internet')).toBeInTheDocument()
    expect(screen.getByText('Not compared (no information): occupation.')).toBeInTheDocument()
    expect(requests.find((request) => request.url.includes('tenant-matches'))?.body).toMatchObject({ monthlyFees: 300000, cityId: 'c1' })

    await userEvent.setup().click(screen.getByRole('button', { name: 'View Profile' }))
    expect(screen.getByText('Up to 350,000 MMK')).toBeInTheDocument()
    expect(screen.getByText(/contact details stay private/i)).toBeInTheDocument()
  })

  it('waits for rent and city before analysing, and never blocks the form', () => {
    stubFetch(true)
    renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 0, cityId: '' }} />)

    expect(screen.getByText(/enter the monthly rent and city/i)).toBeInTheDocument()
    expect(requests.some((request) => request.url.includes('tenant-matches'))).toBe(false)
  })

  it('requires an occupation at sign-up and sends the chosen one', async () => {
    stubFetch(false)
    const user = userEvent.setup()
    renderWithProviders(<SignUpPage />)

    await screen.findByRole('option', { name: 'Remote Worker' })
    const field = (id: string) => document.getElementById(id) as HTMLInputElement
    await user.type(field('name'), 'New User')
    await user.type(field('email'), 'new@example.com')
    await user.type(field('phone'), '0912345678')
    await user.type(field('password'), 'Passw0rd!')
    await user.type(field('confirmPassword'), 'Passw0rd!')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(requests.some((request) => request.url.includes('/auth/register'))).toBe(false)

    await user.selectOptions(screen.getByLabelText('Occupation'), 'occ-remote')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(requests.find((request) => request.url.includes('/auth/register'))?.body).toMatchObject({ occupationId: 'occ-remote' }))
  })
})
