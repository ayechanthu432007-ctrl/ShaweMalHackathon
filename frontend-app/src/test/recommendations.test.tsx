import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SignUpPage } from '@/features/auth/pages/SignUpPage'
import { RecommendedHouses } from '@/features/recommendations/components/RecommendedHouses'
import { IndividualTenantMatches as TenantCompatibility } from '@/features/recommendations/components/TenantCompatibility'
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

const tenants = {
  basis: 'DRAFT',
  evaluated: 1,
  insufficient: 0,
  scoredCount: 1,
  overallScore: 84,
  bestScore: 84,
  strongMatches: 1,
  tiers: { HIGH: 1, MEDIUM: 0, LOW: 0 },
  factorSummary: [
    { key: 'budget', weight: 30, match: 1, partial: 0, conflict: 0, unknown: 0 },
    { key: 'location', weight: 20, match: 1, partial: 0, conflict: 0, unknown: 0 },
    { key: 'amenities', weight: 20, match: 0, partial: 0, conflict: 1, unknown: 0 },
    { key: 'space', weight: 15, match: 1, partial: 0, conflict: 0, unknown: 0 },
    { key: 'timing', weight: 10, match: 0, partial: 0, conflict: 0, unknown: 1 },
    { key: 'rules', weight: 5, match: 0, partial: 0, conflict: 0, unknown: 1 },
  ],
  method: {
    weights: { budget: 30, location: 20, amenities: 20, space: 15, timing: 10, rules: 5 },
    thresholds: { strong: 75, medium: 50, minJudgedShare: 40, highConfidenceShare: 60, budgetConflictCap: 40 },
  },
  total: 1,
  page: 1,
  pageSize: 5,
  items: [
    {
      user: { id: 'u3', name: 'Su Su', profilePicturePath: null, occupation: 'Remote Worker' },
      lookingFor: { preferredCity: 'Yangon', budgetMin: null, budgetMax: 350000, bedroomsMin: 2, propertyType: null, moveInDate: null, leaseMonths: 6 },
      match: match(84, {
        tier: 'HIGH',
        matched: ['budget', 'location', 'space'],
        conflicts: ['amenities'],
        missing: ['timing', 'rules'],
        factors: [],
        reasons: [
          { factor: 'budget', status: 'match', code: 'budget.within' },
          { factor: 'location', status: 'match', code: 'location.city' },
          { factor: 'amenities', status: 'conflict', code: 'amenities.none', params: { missing: 'WIFI' } },
        ],
      }),
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

  it('analyses a listing draft for the agent and shows matches, conflicts and a limited profile', async () => {
    stubFetch(true)
    renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 300000, cityId: 'c1', bedrooms: 2, amenityIds: [] }} />)

    expect(await screen.findByText('Su Su', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getAllByText('84%').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Remote Worker')).toBeInTheDocument()
    expect(screen.getByText('Within budget')).toBeInTheDocument()
    expect(screen.getByText('Missing required amenities: WIFI')).toBeInTheDocument()
    expect(screen.getByText('Not stated, so not scored: Lease and move-in, Smoking rule.')).toBeInTheDocument()
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
