import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TenantCompatibility } from '@/features/recommendations/components/TenantCompatibility'
import { renderWithProviders } from '@/test/utils'

const NAMES = ['Engineer', 'General Worker', 'Healthcare Professional', 'Other', 'Remote Worker', 'Software / IT Professional', 'Student', 'Teacher / Educator']

/** A stand-in server that derives scores from the draft, like the real endpoint. */
function compute(body: Record<string, unknown>) {
  const rent = Number(body.monthlyFees ?? 0)
  const wifi = Array.isArray(body.amenityIds) && body.amenityIds.includes('a-wifi')
  const items = NAMES.map((name, index) => {
    const base = rent ? Math.max(0, 90 - Math.round(rent / 20000)) - index : null
    const score = base === null ? null : Math.min(100, base + (wifi && name.includes('Remote') ? 15 : 0))
    return {
      id: `o${index}`,
      name,
      score,
      judgedShare: score === null ? 0 : 60,
      limited: score === null,
      weights: { affordability: 30, facilities: 25, location: 20, space: 15, rules: 10 },
      reasons: score === null ? [] : [{ factor: 'affordability', effect: rent > 500000 ? 'down' : 'up', code: rent > 500000 ? 'affordability.high' : 'affordability.low', params: { percent: Math.round(rent / 3500) } }],
      missing: score === null ? ['affordability', 'facilities', 'location', 'space', 'rules'] : ['location'],
    }
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  return { basis: 'DRAFT', typicalRent: 350000, method: { weights: { affordability: 30, facilities: 25, location: 20, space: 15, rules: 10 }, minJudgedShare: 50 }, items }
}

let requests: Array<Record<string, unknown>> = []

beforeEach(() => {
  requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
      const json = (data: unknown) => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (url.includes('/occupation-compatibility')) {
        requests.push(body)
        return json(compute(body))
      }
      if (url.includes('/tenant-matches')) return json({ basis: 'DRAFT', evaluated: 0, insufficient: 0, scoredCount: 0, overallScore: null, bestScore: null, strongMatches: 0, tiers: { HIGH: 0, MEDIUM: 0, LOW: 0 }, factorSummary: [], method: { weights: {}, thresholds: { strong: 75, medium: 50 } }, total: 0, page: 1, pageSize: 5, items: [] })
      return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const rows = () => screen.getAllByTestId('occupation-row')
const rowFor = (name: string) => rows().find((row) => within(row).queryByText(name))!

describe('occupation compatibility on the listing form', () => {
  it('shows every occupation with a percentage, bar and explanation, best first', async () => {
    renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 300000, cityId: 'c1', amenityIds: [] }} />)
    await waitFor(() => expect(rows()).toHaveLength(NAMES.length), { timeout: 3000 })
    for (const name of NAMES) expect(rowFor(name)).toBeTruthy()

    const scores = rows().map((row) => Number(within(row).getByText(/^\d+%$/).textContent?.replace('%', '')))
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(within(rows()[0]).getByRole('progressbar')).toBeInTheDocument()
    expect(within(rows()[0]).getByText(/typical rent here: affordable/i)).toBeInTheDocument()
    expect(within(rows()[0]).getByText(/not yet entered, so not scored: nearby places/i)).toBeInTheDocument()
    expect(screen.queryByText(/no strong matches yet/i)).not.toBeInTheDocument()
  })

  it('recalculates from unsaved form values when rent or amenities change', async () => {
    const { rerender } = renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 300000, cityId: 'c1', amenityIds: [] }} />)
    await waitFor(() => expect(rows()).toHaveLength(NAMES.length), { timeout: 3000 })
    const before = within(rowFor('Remote Worker')).getByText(/^\d+%$/).textContent

    rerender(<TenantCompatibility draft={{ monthlyFees: 300000, cityId: 'c1', amenityIds: ['a-wifi'], houseRules: 'Quiet hours' }} />)
    await waitFor(() => expect(within(rowFor('Remote Worker')).getByText(/^\d+%$/).textContent).not.toBe(before), { timeout: 3000 })
    expect(requests.at(-1)).toMatchObject({ amenityIds: ['a-wifi'], houseRules: 'Quiet hours' })

    rerender(<TenantCompatibility draft={{ monthlyFees: 900000, cityId: 'c1', amenityIds: ['a-wifi'] }} />)
    await waitFor(() => expect(within(rowFor('Student')).getByText(/expensive/i)).toBeInTheDocument(), { timeout: 3000 })
  })

  it('shows every occupation and a notice when details are missing, without inventing scores', async () => {
    renderWithProviders(<TenantCompatibility draft={{ monthlyFees: 0, cityId: '' }} />)
    await waitFor(() => expect(rows()).toHaveLength(NAMES.length), { timeout: 3000 })
    expect(screen.getAllByText('Not enough details yet')).toHaveLength(NAMES.length)
    expect(screen.getByText(/some key details are missing/i)).toBeInTheDocument()
  })
})
