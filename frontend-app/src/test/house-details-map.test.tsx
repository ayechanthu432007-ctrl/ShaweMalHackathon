import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HouseDetailsPage } from '@/features/houses/pages/HouseDetailsPage'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/features/houses/components/HouseLocationMap', () => ({
  HouseLocationMap: ({
    streetAddress,
    cityName,
  }: {
    streetAddress?: string | null
    cityName?: string | null
  }) => (
    <div data-testid="house-location-map">
      {[streetAddress, cityName].filter(Boolean).join(' · ')}
    </div>
  ),
}))

describe('house details location map', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/houses/h1')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                item: {
                  id: 'h1',
                  title: 'Inya Garden Flat',
                  description: 'Quiet street',
                  availability: 'AVAILABLE',
                  monthlyFees: 400000,
                  depositAmount: 800000,
                  bedrooms: 2,
                  bathrooms: 1,
                  images: [],
                  amenities: [],
                  contact: { phone: '0911111111' },
                  location: {
                    city: { id: 'c1', name: 'Kamayut Township' },
                    state: { id: 's1', name: 'Yangon' },
                    streetAddress: '42 Inya Road',
                    latitude: 16.8294,
                    longitude: 96.1356,
                    nearbyPlaces: 'Inya Lake',
                  },
                  agent: { id: 'a1', name: 'Agent Ada' },
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
      }),
    )
  })

  it('shows the location map region on house details', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/houses/:id" element={<HouseDetailsPage />} />
      </Routes>,
      { initialEntries: ['/houses/h1'] },
    )

    expect(await screen.findByRole('heading', { name: 'Inya Garden Flat' })).toBeInTheDocument()
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
    expect(screen.getByText(/^availability$/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /location map/i })).toBeInTheDocument()
    expect(screen.getByTestId('house-location-map')).toHaveTextContent('42 Inya Road · Kamayut Township')

    const detailsHeading = screen.getByText(/^house details$/i)
    const agentHeading = screen.getByText(/^agent details$/i)
    const mapHeading = screen.getByRole('heading', { name: /location map/i })
    expect(detailsHeading.compareDocumentPosition(mapHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(agentHeading.compareDocumentPosition(mapHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
