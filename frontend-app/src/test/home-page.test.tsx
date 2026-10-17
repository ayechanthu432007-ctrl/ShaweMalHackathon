import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HomePage } from '@/features/home/pages/HomePage'
import { renderWithProviders } from '@/test/utils'

const homePayload = {
  featuredHouses: [
    {
      id: 'h1',
      title: 'Golden Condo',
      monthlyFees: 450000,
      propertyType: { id: 'pt1', name: 'Condo' },
      city: { id: 'c1', name: 'Yangon' },
      thumbnail: null,
    },
  ],
  popularRecommended: [],
  verifiedAgents: [
    { id: 'a1', name: 'Agent A', hasVerifiedBadge: true, agentProfile: { city: { id: 'c1', name: 'Yangon' } } },
    { id: 'a2', name: 'Agent B', hasVerifiedBadge: false, agentProfile: { city: { id: 'c1', name: 'Yangon' } } },
  ],
  partnerMovingServices: [],
  serviceReviews: [],
  newsUpdates: [{ id: 'n1', title: 'Welcome to ShweMal', summary: 'Hello', publishedAt: '2026-08-12' }],
}

describe('home page', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/home')) {
          return new Response(JSON.stringify({ success: true, message: 'ok', data: homePayload }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
      }),
    )
  })

  it('renders the redesigned homepage in the required order from real data', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>,
    )

    expect(await screen.findByRole('heading', { name: /myanmar.?s all-in-one relocation platform/i })).toBeInTheDocument()
    expect(screen.getByText(/find homes, meet roommates, arrange your move/i)).toBeInTheDocument()
    expect(await screen.findByText('Welcome to ShweMal')).toBeInTheDocument()

    // Required section order.
    const order = [
      /myanmar.?s all-in-one relocation platform/i,
      /popular houses/i,
      /ready to take the next step/i,
      /how shawe mal works/i,
      /housing agents/i,
      /partner moving services/i,
      /marketplace highlights/i,
      /services & customer reviews/i,
    ].map((name) => screen.getByRole('heading', { name }))
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }

    // Four feature cards link to existing pages.
    const features = within(screen.getByRole('navigation', { name: 'Main services' }))
    expect(features.getByRole('link', { name: /find a home/i })).toHaveAttribute('href', '/finding-house')
    expect(features.getByRole('link', { name: /find roommates/i })).toHaveAttribute('href', '/finding-roommates')
    expect(features.getByRole('link', { name: /moving services/i })).toHaveAttribute('href', '/hire-moving')
    expect(features.getByRole('link', { name: /marketplace/i })).toHaveAttribute('href', '/marketplace')

    // The two primary CTAs live in the banner after Popular Houses, not in the hero.
    const cta = within(screen.getByRole('region', { name: /ready to take the next step/i }))
    expect(cta.getByRole('link', { name: /find your home/i })).toHaveAttribute('href', '/finding-house')
    expect(cta.getByRole('link', { name: /plan your move/i })).toHaveAttribute('href', '/hire-moving')

    // Real agents; only the badge holder is marked verified.
    expect(screen.getByText('Agent A').parentElement).toHaveTextContent('Verified')
    expect(screen.getByText('Agent B').parentElement).not.toHaveTextContent('Verified')

    // No reviews in the data: an honest empty state, no invented ratings.
    expect(screen.getByRole('heading', { name: 'What Our Customers Say' })).toBeInTheDocument()
    expect(screen.getByText('Customer reviews will appear here when available.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /stars?/i })).not.toBeInTheDocument()
  })
})
