import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FeatureHouses } from '@/features/houses/components/FeatureHouses'
import { renderWithProviders } from '@/test/utils'

function featuredHouse(index: number) {
  return {
    id: `h${index}`,
    title: `Featured House ${index}`,
    monthlyFees: 400000 + index,
    propertyType: { id: 'pt1', name: 'Condo' },
    city: { id: 'c1', name: 'Yangon' },
    thumbnail: null,
  }
}

function stubHome(houses: ReturnType<typeof featuredHouse>[]) {
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
              featuredHouses: houses,
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
      return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
    }),
  )
}

describe('featured houses', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows three cards and hides pager when there are three or fewer houses', async () => {
    stubHome([featuredHouse(1), featuredHouse(2), featuredHouse(3)])

    renderWithProviders(<FeatureHouses />)

    expect(await screen.findByText('Featured House 1')).toBeInTheDocument()
    expect(screen.getByText('Featured House 2')).toBeInTheDocument()
    expect(screen.getByText('Featured House 3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument()
  })

  it('pages through extra houses with previous and next instead of wrapping them', async () => {
    const user = userEvent.setup()
    stubHome([featuredHouse(1), featuredHouse(2), featuredHouse(3), featuredHouse(4), featuredHouse(5)])

    renderWithProviders(<FeatureHouses />)

    expect(await screen.findByText('Featured House 1')).toBeInTheDocument()
    expect(screen.getByText('Featured House 2')).toBeInTheDocument()
    expect(screen.getByText('Featured House 3')).toBeInTheDocument()
    expect(screen.queryByText('Featured House 4')).not.toBeInTheDocument()
    expect(screen.queryByText('Featured House 5')).not.toBeInTheDocument()

    const previous = screen.getByRole('button', { name: /previous/i })
    const next = screen.getByRole('button', { name: /^next$/i })
    expect(previous).toBeDisabled()

    await user.click(next)

    expect(screen.queryByText('Featured House 1')).not.toBeInTheDocument()
    expect(screen.getByText('Featured House 4')).toBeInTheDocument()
    expect(screen.getByText('Featured House 5')).toBeInTheDocument()
    expect(next).toBeDisabled()

    await user.click(previous)

    expect(screen.getByText('Featured House 1')).toBeInTheDocument()
    expect(screen.queryByText('Featured House 4')).not.toBeInTheDocument()
  })

  it('does not fetch featured houses until the section becomes visible', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/home')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: {
              featuredHouses: [featuredHouse(1), featuredHouse(2)],
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
      return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
    })

    vi.stubGlobal('fetch', fetchSpy)

    const originalIntersectionObserver = window.IntersectionObserver
    class MockIntersectionObserver {
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
      constructor(_: IntersectionObserverCallback, __?: IntersectionObserverInit) {
        // leave the section hidden until the app explicitly decides to reveal it
      }
    }
    // @ts-expect-error - test hook for deferred loading
    window.IntersectionObserver = MockIntersectionObserver

    renderWithProviders(<FeatureHouses />)

    await Promise.resolve()
    expect(fetchSpy).not.toHaveBeenCalled()

    window.IntersectionObserver = originalIntersectionObserver
  })
})
