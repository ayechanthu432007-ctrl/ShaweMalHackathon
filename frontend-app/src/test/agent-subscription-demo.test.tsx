import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentSubscriptionPage } from '@/features/agent/pages/AgentSubscriptionPages'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

const plan = (code: string, name: string, rank: number, monthly: number, extra: Record<string, unknown> = {}) => ({
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
  ...extra,
})

const PLANS = [
  plan('FREE', 'Free Basic', 0, 0),
  plan('SILVER', 'Silver Partner', 1, 90000, { monthlyListingLimit: 15, freeBoostDays: 3, badgeEligible: true, performanceLevel: 'OVERVIEW' }),
  plan('GOLD', 'Gold Premium', 2, 160000, { monthlyListingLimit: null, freeBoostDays: 10, badgeEligible: true, performanceLevel: 'DETAILED', audienceInsights: true, monthlyReport: true }),
]

function dashboard(currentCode: string, demoPayments: boolean) {
  const current = PLANS.find((item) => item.code === currentCode)!
  return {
    plan: current,
    subscription: { status: currentCode === 'FREE' ? 'FREE' : 'ACTIVE', billingMonths: null, startsAt: null, endsAt: '2026-11-15T00:00:00.000Z', daysRemaining: 30 },
    plans: PLANS,
    listingUsage: { month: '2026-10', used: 0, limit: 5, remaining: 5, resetsAt: '2026-11-01T00:00:00.000Z' },
    listingCount: 0,
    freeBoost: { granted: 0, used: 0, remaining: 0, expiresAt: null },
    activeBoosts: 0,
    boostPricePerDay: 3000,
    demoPayments,
  }
}

const json = (data: unknown) => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })

function createToken() {
  const payload = btoa(JSON.stringify({ sub: 'agent-1', roles: ['agent'], exp: Math.floor(Date.now() / 1000) + 3600 }))
  return `x.${payload}.y`
}

function stubServer(state: { current: string; demo: boolean }) {
  tokenStorage.setTokens(createToken(), 'refresh', true)
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (method !== 'GET' && !url.includes('/auth/')) calls.push(`${method} ${url.replace(/^.*\/api\/v1/, '')}`)
      if (url.includes('/auth/')) return json({ user: { id: 'agent-1', name: 'Agent', email: 'agent@example.test', roles: ['agent'] } })
      if (url.includes('/agent/subscription/demo-reset')) {
        state.current = 'FREE'
        return json({ ended: 1 })
      }
      if (url.includes('/agent/subscription/orders')) {
        const body = JSON.parse(String(init?.body))
        state.current = body.planCode
        return json({ order: { reference: `ORD-${body.planCode}`, isDemo: true } })
      }
      if (url.includes('/demo')) return json({ result: 'APPLIED', status: 'PAID', order: {} })
      if (url.includes('/agent/payments/orders')) return json({ items: [] })
      if (url.includes('/agent/dashboard')) return json({ dashboard: dashboard(state.current, state.demo) })
      return json({})
    }),
  )
  return calls
}

describe('agent plans in demo mode', () => {
  afterEach(() => {
    tokenStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows each plan, without photos, and the 3-month price with 10% off', async () => {
    stubServer({ current: 'FREE', demo: true })
    const user = userEvent.setup()
    renderWithProviders(<AgentSubscriptionPage />)

    expect(await screen.findByText(/DEMO MODE — No real payment required/)).toBeInTheDocument()
    // The plan cards use coloured backgrounds instead of photos.
    expect(document.querySelectorAll('img')).toHaveLength(0)
    for (const name of ['Free Basic', 'Silver Partner', 'Gold Premium']) expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    expect(screen.getByText('90,000 MMK')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '3 months (10% off)' }))
    expect(screen.getByText('243,000 MMK')).toBeInTheDocument()
    expect(screen.getByText('432,000 MMK')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current Plan' })).toBeDisabled()
  })

  it('does nothing when the dialog is cancelled', async () => {
    const calls = stubServer({ current: 'FREE', demo: true })
    const user = userEvent.setup()
    renderWithProviders(<AgentSubscriptionPage />)

    await user.click(await screen.findByRole('button', { name: 'Choose Silver Partner' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Silver Partner')
    expect(dialog).toHaveTextContent('90,000 MMK')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('switches up, then down through Free Basic, and back to Free', async () => {
    const calls = stubServer({ current: 'FREE', demo: true })
    const user = userEvent.setup()
    renderWithProviders(<AgentSubscriptionPage />)

    await user.click(await screen.findByRole('button', { name: 'Choose Gold Premium' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Demo Subscription' }))
    expect(await screen.findByText('Demo plan changed to Gold Premium.')).toBeInTheDocument()
    expect(calls).toEqual(['POST /agent/subscription/orders', 'POST /agent/payments/orders/ORD-GOLD/demo'])

    // A lower plan first returns to Free Basic, then subscribes.
    await user.click(await screen.findByRole('button', { name: 'Choose Silver Partner' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Demo Subscription' }))
    expect(await screen.findByText('Demo plan changed to Silver Partner.')).toBeInTheDocument()
    expect(calls.slice(2)).toEqual(['POST /agent/subscription/demo-reset', 'POST /agent/subscription/orders', 'POST /agent/payments/orders/ORD-SILVER/demo'])

    await user.click(await screen.findByRole('button', { name: 'Return to Free Basic' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Demo Subscription' }))
    expect(await screen.findByText('Demo plan changed to Free Basic.')).toBeInTheDocument()
    expect(calls.slice(5)).toEqual(['POST /agent/subscription/demo-reset'])
  })

  it('offers no plan changes where demo payments are off, such as production', async () => {
    const calls = stubServer({ current: 'FREE', demo: false })
    renderWithProviders(<AgentSubscriptionPage />)

    expect(await screen.findByText('Online payment is not available in this environment yet.')).toBeInTheDocument()
    expect(screen.queryByText(/DEMO MODE/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose Silver Partner' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose Gold Premium' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Return to Free Basic' })).not.toBeInTheDocument()
    expect(calls).toEqual([])
  })
})

describe('agent plans as a browser-only demo preview on the live site', () => {
  afterEach(() => {
    tokenStorage.clear()
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('switches the shown plan without any order or payment and keeps it after a reload', async () => {
    vi.stubEnv('VITE_DEMO_PLAN_PREVIEW', 'true')
    const PreviewPage = AgentSubscriptionPage
    const calls = stubServer({ current: 'FREE', demo: false })
    const user = userEvent.setup()
    const view = renderWithProviders(<PreviewPage />)

    expect(await screen.findByText(/your actual plan features stay on Free Basic/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '3 months (10% off)' }))
    await user.click(screen.getByRole('button', { name: 'Choose Gold Premium' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('432,000 MMK')
    expect(dialog).toHaveTextContent('3 months (10% off)')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm Demo Subscription' }))

    expect(await screen.findByText('Demo plan changed to Gold Premium.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current Plan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to Free Basic' })).toBeInTheDocument()
    expect(calls).toEqual([])

    // A reload keeps the choice.
    view.unmount()
    renderWithProviders(<PreviewPage />)
    expect(await screen.findByRole('button', { name: 'Return to Free Basic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose Silver Partner' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Return to Free Basic' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Demo Subscription' }))
    expect(await screen.findByText('Demo plan changed to Free Basic.')).toBeInTheDocument()
    expect(calls).toEqual([])
  })
})
