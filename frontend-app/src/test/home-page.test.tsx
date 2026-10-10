import { screen } from '@testing-library/react'
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

  it('renders home sections from API without a global search box', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>,
    )

    expect(
      await screen.findByRole('heading', { name: /myanmar.?s all-in-one relocation platform/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Find Your Place. Plan Your Move. Settle In.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'From personalized home searching to trusted moving services — everything you need, all in one place',
      ),
    ).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /your new place\. your new chapter\./i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /featured houses/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Golden Condo')).not.toBeInTheDocument()
    expect(screen.getByText('Simple & Convenient')).toBeInTheDocument()
    expect(screen.getByText('Support Throughout Your Move')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /how shawe mal works\?/i })).toBeInTheDocument()
    expect(screen.getByText('Find Your Home')).toBeInTheDocument()
    expect(screen.getByText('Stay Updated')).toBeInTheDocument()
    expect(screen.getByText('Welcome to ShweMal')).toBeInTheDocument()
    expect(screen.getByText('Agent A')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Housing agents' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /verified housing agents/i })).not.toBeInTheDocument()
    // Only the agent holding the badge is marked as verified.
    expect(screen.getAllByText('Verified')).toHaveLength(1)
    expect(screen.getByText('Agent A').parentElement).toHaveTextContent('Verified')
    expect(screen.getByText('Agent B').parentElement).not.toHaveTextContent('Verified')
    expect(screen.queryByLabelText(/search houses by city/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /search houses/i })).not.toBeInTheDocument()
  })
})
