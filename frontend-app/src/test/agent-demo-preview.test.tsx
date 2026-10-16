import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentDashboardLayout } from '@/features/agent/layout/AgentDashboardLayout'
import { activeDemoBoost, DemoBoostError, withDemoBoost } from '@/features/agent/lib/agent-demo-preview'
import { AgentDashboardPage } from '@/features/agent/pages/AgentDashboardPage'
import { AgentBoostsPage } from '@/features/agent/pages/AgentPremiumPages'
import { AgentSubscriptionPage } from '@/features/agent/pages/AgentSubscriptionPages'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

const plan = (code: string, name: string, rank: number, monthly: number) => ({
  code,
  name,
  rank,
  monthlyPriceMmk: monthly,
  quarterlyPriceMmk: Math.round(monthly * 3 * 0.9),
  monthlyListingLimit: 5,
  freeBoostDays: 0,
  badgeEligible: false,
  performanceLevel: 'BASIC',
  audienceInsights: false,
  monthlyReport: false,
})
const PLANS = [plan('FREE', 'Free Basic', 0, 0), plan('SILVER', 'Silver Partner', 1, 90000), plan('GOLD', 'Gold Premium', 2, 160000)]
const totals = { views: 0, calls: 0, telegram: 0, viber: 0, contacts: 0 }

// What the live API returns: the real plan is Free and simulated payments are refused.
const DASHBOARD = {
  plan: PLANS[0],
  subscription: { status: 'FREE', billingMonths: null, startsAt: null, endsAt: null, daysRemaining: null },
  plans: PLANS,
  listingUsage: { month: '2026-10', used: 1, limit: 5, remaining: 4, resetsAt: '2026-11-01T00:00:00.000Z' },
  listingCount: 1,
  freeBoost: { granted: 0, used: 0, remaining: 0, expiresAt: null },
  activeBoosts: 0,
  boostPricePerDay: 3000,
  demoPayments: false,
  verification: { status: 'NONE', badgeShown: false, eligible: false },
  features: { performanceOverview: false, performanceDetailed: false, audienceInsights: false, monthlyReport: false },
  last30Days: totals,
}

const json = (data: unknown) => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
const token = () => `x.${btoa(JSON.stringify({ sub: 'agent-1', exp: Math.floor(Date.now() / 1000) + 3600 }))}.y`

let writes: string[] = []

beforeEach(() => {
  writes = []
  localStorage.clear()
  vi.stubEnv('VITE_DEMO_PLAN_PREVIEW', 'true')
  tokenStorage.setTokens(token(), 'refresh', true)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if ((init?.method ?? 'GET') !== 'GET' && !url.includes('/auth/')) writes.push(url)
      if (url.includes('/auth/')) return json({ user: { id: 'agent-1', name: 'Khoon', email: 'k@example.test', roles: ['agent'] } })
      if (url.includes('/agent/dashboard')) return json({ dashboard: DASHBOARD })
      if (url.includes('/agent/houses')) return json({ items: [{ id: 'h1', title: 'Parami Valley Condo', availability: 'AVAILABLE' }, { id: 'h2', title: 'Bahan family house', availability: 'AVAILABLE' }] })
      if (url.includes('/agent/boosts')) return json({ items: [] })
      if (url.includes('/agent/payments/orders')) return json({ items: [] })
      return json({ items: [] })
    }),
  )
})
afterEach(() => {
  tokenStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const renderAgent = (path: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/agent" element={<AgentDashboardLayout />}>
        <Route path="dashboard" element={<AgentDashboardPage />} />
        <Route path="subscription" element={<AgentSubscriptionPage />} />
        <Route path="boosts" element={<AgentBoostsPage />} />
      </Route>
    </Routes>,
    { initialEntries: [path] },
  )

describe('agent demo on the live site', () => {
  it('shows the chosen demo plan on the plans page, sidebar and dashboard, and keeps it after a reload', async () => {
    const user = userEvent.setup()
    const view = renderAgent('/agent/subscription')

    await user.click(await screen.findByRole('button', { name: 'Choose Gold Premium' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Demo Subscription' }))
    expect(await screen.findByText('Demo plan changed to Gold Premium.')).toBeInTheDocument()
    // The sidebar no longer says Free.
    expect(await screen.findByText(/Demo choice · real plan: Free Basic/)).toBeInTheDocument()
    view.unmount()

    // A full reload of the dashboard still shows the demo plan.
    renderAgent('/agent/dashboard')
    const planBox = await screen.findByRole('region', { name: 'Current plan' })
    expect(within(planBox).getByText('Gold Premium')).toBeInTheDocument()
    expect(within(planBox).getByText('DEMO')).toBeInTheDocument()
    expect(writes).toEqual([])
  })

  it('cancelling the plan dialog changes nothing', async () => {
    const user = userEvent.setup()
    renderAgent('/agent/subscription')
    await user.click(await screen.findByRole('button', { name: 'Choose Silver Partner' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Demo choice/)).not.toBeInTheDocument()
    expect(localStorage.getItem('shawemal.agentDemoPreview.agent-1')).toBeNull()
  })

  it('boosts one listing in the demo, refuses a second boost, and never calls the payment API', async () => {
    const user = userEvent.setup()
    renderAgent('/agent/boosts')

    await user.selectOptions(await screen.findByLabelText('Listing'), 'h1')
    await user.click(screen.getByRole('button', { name: /Buy boost/ }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Parami Valley Condo')
    expect(dialog).toHaveTextContent('3,000 MMK')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm Demo Payment' }))

    expect(screen.getByText(/is boosted for 1 day\(s\) in the demo/)).toBeInTheDocument()
    expect(screen.getByText('BOOSTED — DEMO')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Demo boost active' })).toBeDisabled()
    expect(writes).toEqual([])
  })

  it('leaves the listing unboosted when the demo payment fails', async () => {
    const user = userEvent.setup()
    renderAgent('/agent/boosts')
    await user.selectOptions(await screen.findByLabelText('Listing'), 'h2')
    await user.click(screen.getByRole('button', { name: /Buy boost/ }))
    await user.click(screen.getByRole('button', { name: 'Simulate failure' }))
    expect(screen.getByRole('alert')).toHaveTextContent('was not boosted')
    expect(screen.queryByText('BOOSTED — DEMO')).not.toBeInTheDocument()
  })
})

describe('demo boost rules', () => {
  it('lasts the chosen days and is never charged twice while active', () => {
    const now = Date.parse('2026-10-16T05:00:00.000Z')
    const state = withDemoBoost({ plan: null, boosts: [] }, { houseId: 'h1', title: 'A', days: 2, amountMmk: 6000 }, now)
    expect(activeDemoBoost(state, 'h1', now)?.expiresAt).toBe(now + 2 * 24 * 3_600_000)
    expect(() => withDemoBoost(state, { houseId: 'h1', title: 'A', days: 1, amountMmk: 3000 }, now + 1000)).toThrow(DemoBoostError)
    expect(activeDemoBoost(state, 'h1', now + 2 * 24 * 3_600_000)).toBeNull()
  })
})
