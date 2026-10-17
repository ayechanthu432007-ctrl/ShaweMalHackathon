import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IndividualTenantMatches as TenantCompatibility } from '@/features/recommendations/components/TenantCompatibility'
import { renderWithProviders } from '@/test/utils'

const method = {
  weights: { budget: 30, location: 20, amenities: 20, space: 15, timing: 10, rules: 5 },
  thresholds: { strong: 75, medium: 50, minJudgedShare: 40, highConfidenceShare: 60, budgetConflictCap: 40 },
}

const summary = (overrides: Record<string, unknown> = {}) => ({
  basis: 'DRAFT',
  evaluated: 0,
  insufficient: 0,
  scoredCount: 0,
  overallScore: null,
  bestScore: null,
  strongMatches: 0,
  tiers: { HIGH: 0, MEDIUM: 0, LOW: 0 },
  factorSummary: [],
  method,
  total: 0,
  page: 1,
  pageSize: 5,
  items: [],
  ...overrides,
})

const overBudgetTenant = {
  user: { id: 'u1', name: 'Aung', profilePicturePath: null, occupation: null },
  lookingFor: { preferredCity: 'Tamwe', budgetMin: null, budgetMax: 200000, bedroomsMin: null, propertyType: null, moveInDate: null, leaseMonths: null },
  match: {
    score: 40,
    confidence: 'HIGH',
    tier: 'LOW',
    matched: ['location'],
    conflicts: ['budget'],
    missing: [],
    factors: [],
    reasons: [
      { factor: 'budget', status: 'conflict', code: 'budget.over', params: { over: 400000 } },
      { factor: 'location', status: 'match', code: 'location.city' },
    ],
  },
}

let requests: Array<Record<string, unknown>> = []
let respond: (body: Record<string, unknown>) => unknown = () => summary()

beforeEach(() => {
  requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
      if (String(input).includes('/agent/houses/tenant-matches')) {
        requests.push(body)
        return new Response(JSON.stringify({ success: true, message: 'ok', data: respond(body) }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('Potential Tenant Compatibility', () => {
  it('says clearly when nobody has opted in, instead of a generic "no matches" line', async () => {
    respond = () => summary()
    renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 300000, cityId: 'c1' }} />)
    expect(await screen.findByText(/no one has asked to be suggested to housing agents yet/i, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByText(/no strong matches yet/i)).not.toBeInTheDocument()
  })

  it('reports insufficient profile information rather than a score', async () => {
    respond = () => summary({ evaluated: 2, insufficient: 2 })
    renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 300000, cityId: 'c1' }} />)
    expect(await screen.findByText('Insufficient profile information', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText(/2 people asked to be suggested to agents, but none has stated enough/i)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows the overall score, counts, reasons and the calculation method', async () => {
    respond = () =>
      summary({
        evaluated: 3,
        insufficient: 1,
        scoredCount: 2,
        overallScore: 62,
        bestScore: 84,
        strongMatches: 1,
        tiers: { HIGH: 1, MEDIUM: 0, LOW: 1 },
        factorSummary: [{ key: 'budget', weight: 30, match: 1, partial: 0, conflict: 1, unknown: 0 }],
        total: 1,
        items: [overBudgetTenant],
      })
    renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 600000, cityId: 'c1' }} />)

    expect(await screen.findByText('62%', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Best match: 84%')).toBeInTheDocument()
    expect(screen.getByText('Profiles evaluated').nextSibling).toHaveTextContent('3')
    expect(screen.getByText('Strong matches').nextSibling).toHaveTextContent('1')
    expect(screen.getByText('Rent exceeds their stated budget by 400,000 MMK')).toBeInTheDocument()
    expect(screen.getByText('Preferred township')).toBeInTheDocument()
    expect(screen.getByText('1 fit · 0 partly · 1 conflict')).toBeInTheDocument()
    expect(screen.getByText(/based on the details in the form now \(not saved yet\)/i)).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: /how this is calculated/i }))
    expect(screen.getByText(/occupation is shown for context but never scored/i)).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('recalculates when the listing details change', async () => {
    respond = (body) =>
      summary({ evaluated: 1, scoredCount: 1, overallScore: Number(body.monthlyFees) > 400000 ? 40 : 100, bestScore: 100, items: [] })
    const { rerender } = renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 300000, cityId: 'c1', bedrooms: 2 }} />)
    expect(await screen.findByText('100%', {}, { timeout: 3000 })).toBeInTheDocument()

    rerender(<TenantCompatibility draft={{ monthlyFees: 600000, cityId: 'c1', bedrooms: 2, houseRules: 'No pets' }} />)
    expect(await screen.findByText('40%', {}, { timeout: 3000 })).toBeInTheDocument()
    await waitFor(() => expect(requests.at(-1)).toMatchObject({ monthlyFees: 600000, houseRules: 'No pets' }))
    // Typing is debounced: the two drafts produced two requests, not one per keystroke.
    expect(requests).toHaveLength(2)
  })
})
