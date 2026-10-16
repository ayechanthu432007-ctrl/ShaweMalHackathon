import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SellerBadges } from '@/features/marketplace/components/SellerBadges'
import { SellerPlanComparison } from '@/features/marketplace/pages/SellerPlansPages'
import type { SellerPlan } from '@/features/marketplace/types'
import { renderWithProviders } from '@/test/utils'

const PLANS: SellerPlan[] = [
  { code: 'SELLER_FREE', name: 'Free Seller', rank: 0, monthlyPriceMmk: 0, activeListingLimit: 5, freeBoostDays: 0, premiumBadge: false, homepageFeatured: false, insightsLevel: 'BASIC' },
  { code: 'SELLER_PREMIUM', name: 'Premium Seller', rank: 1, monthlyPriceMmk: 90000, activeListingLimit: null, freeBoostDays: 3, premiumBadge: true, homepageFeatured: true, insightsLevel: 'DETAILED' },
]

function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const match = Object.keys(routes).find((path) => url.includes(path))
      if (!match) return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
      return new Response(JSON.stringify({ success: true, message: 'ok', data: routes[match] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('seller plan comparison', () => {
  it('shows prices and benefits from the plan catalogue the server returns', async () => {
    stubFetch({ '/marketplace/seller-plans': { plans: PLANS, demoPayments: true } })
    renderWithProviders(<SellerPlanComparison />)

    const table = await screen.findByRole('table')
    const row = (label: string) => within(table).getByRole('row', { name: new RegExp(label) })
    expect(within(row('Monthly price')).getByText('0 MMK')).toBeInTheDocument()
    expect(within(row('Monthly price')).getByText('90,000 MMK')).toBeInTheDocument()
    expect(within(row('Product listings')).getByText('Up to 5')).toBeInTheDocument()
    expect(within(row('Product listings')).getByText('Unlimited')).toBeInTheDocument()
    expect(within(row('Free product boost')).getByText('3 days')).toBeInTheDocument()
    expect(within(row('Product views')).getByText('Detailed insights')).toBeInTheDocument()
    expect(screen.getByText(/no real payment is taken/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activate Premium (Demo)' })).toBeEnabled()
  })

  it('disables the paid upgrade and names the missing setting when no payment method is available', async () => {
    stubFetch({ '/marketplace/seller-plans': { plans: PLANS, demoPayments: false } })
    renderWithProviders(<SellerPlanComparison />)

    expect(await screen.findByRole('button', { name: 'Upgrade to Premium' })).toBeDisabled()
    expect(screen.getByText(/MARKETPLACE_DEMO_PURCHASE_ENABLED/)).toBeInTheDocument()
  })
})

describe('premium seller badge', () => {
  it('renders the Premium Seller badge', () => {
    renderWithProviders(<SellerBadges badges={['PREMIUM_SELLER']} />)
    expect(screen.getByText('Premium Seller')).toBeInTheDocument()
  })
})
