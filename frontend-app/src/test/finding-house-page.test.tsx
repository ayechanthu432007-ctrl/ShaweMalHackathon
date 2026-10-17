import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FindingHousePage } from '@/features/houses/pages/FindingHousePage'
import { renderWithProviders } from '@/test/utils'

describe('finding house page', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/home')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
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
                verifiedAgents: [],
                partnerMovingServices: [],
                serviceReviews: [],
                newsUpdates: [],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        if (url.includes('/master-data/cities') || url.includes('/master-data/property-types')) {
          return new Response(JSON.stringify({ success: true, message: 'ok', data: { items: [] } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (url.includes('/houses')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: { items: [], total: 0, page: 1, pageSize: 12, totalPages: 0 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
      }),
    )
  })

  it('renders featured houses immediately before the house filter form', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/finding-house" element={<FindingHousePage />} />
      </Routes>,
      { initialEntries: ['/finding-house'] },
    )

    expect(await screen.findByRole('heading', { name: /featured houses/i })).toBeInTheDocument()
    // The heading shows while loading (no layout jump); the cards follow once the data arrives.
    expect(await screen.findByText('Golden Condo')).toBeInTheDocument()

    const featuredHeading = screen.getByRole('heading', { name: /featured houses/i })
    const filterForm = screen.getByRole('button', { name: /^search$/i }).closest('form')
    expect(filterForm).toBeTruthy()
    expect(
      featuredHeading.compareDocumentPosition(filterForm as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
