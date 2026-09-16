import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router'

import { ContactSellerButtons } from '@/features/marketplace/components/ContactSellerButtons'
import { ListingCard } from '@/features/marketplace/components/ListingCard'
import { MarketplacePhotoUploader } from '@/features/marketplace/components/MarketplacePhotoUploader'
import { SellerBadges } from '@/features/marketplace/components/SellerBadges'
import { MarketplaceHomePage } from '@/features/marketplace/pages/MarketplaceHomePage'
import type { ListingCard as ListingCardData, MarketplaceHome } from '@/features/marketplace/types'
import { renderWithProviders } from '@/test/utils'

function listing(overrides: Partial<ListingCardData> = {}): ListingCardData {
  return {
    id: 'l1',
    title: 'Wooden study desk',
    price: 85000,
    condition: 'GOOD',
    status: 'ACTIVE',
    moderationStatus: 'APPROVED',
    category: { id: 'c1', name: 'Study', nameMy: null, slug: 'study' },
    subcategory: { id: 's1', name: 'Desk', nameMy: null, slug: 'study-desk' },
    city: { id: 'city1', name: 'Tamwe' },
    state: { id: 'st1', name: 'Yangon' },
    locationDetail: null,
    thumbnail: null,
    seller: {
      id: 'seller1',
      name: 'Aye Aye',
      profilePicturePath: null,
      joinedAt: '2026-01-01T00:00:00.000Z',
      badges: ['PHONE_VERIFIED'],
      rating: { average: 4.5, count: 2 },
    },
    movingOutSaleId: null,
    publishedAt: '2026-09-01T00:00:00.000Z',
    soldAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function stubFetch(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const match = Object.keys(routes).find((path) => url.includes(path))
    if (!match) {
      return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
    }
    return new Response(JSON.stringify({ success: true, message: 'ok', data: routes[match] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('marketplace listing card', () => {
  it('shows price, township, condition, and seller rating', () => {
    renderWithProviders(<ListingCard listing={listing()} />)

    expect(screen.getByText('85,000 MMK')).toBeInTheDocument()
    expect(screen.getByText('Tamwe')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/marketplace/items/l1')
  })

  it('marks sold items and hides the save button', () => {
    renderWithProviders(<ListingCard listing={listing({ status: 'SOLD' })} />)

    expect(screen.getByText('Sold')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})

describe('seller badges', () => {
  it('gives each verification level its own label and meaning', () => {
    renderWithProviders(<SellerBadges badges={['PHONE_VERIFIED', 'IDENTITY_VERIFIED', 'TRUSTED_SELLER']} showDescriptions />)

    expect(screen.getByText('Phone verified')).toBeInTheDocument()
    expect(screen.getByText('Identity verified')).toBeInTheDocument()
    expect(screen.getByText('Trusted seller')).toBeInTheDocument()
    expect(screen.getByText(/multiple completed sales/)).toBeInTheDocument()
  })
})

describe('contact seller buttons', () => {
  it('sends guests to sign in instead of revealing contact details', async () => {
    const fetchMock = stubFetch({})
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/marketplace/items/l1" element={<ContactSellerButtons listingId="l1" methods={['phone', 'telegram']} />} />
        <Route path="/sign-in" element={<p>Sign in page</p>} />
      </Routes>,
      { initialEntries: ['/marketplace/items/l1'] },
    )

    expect(screen.queryByText(/09/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Telegram' }))

    expect(await screen.findByText('Sign in page')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/contact'))).toBe(false)
  })
})

describe('marketplace photo uploader', () => {
  const photos = ['uploads/marketplace/a.jpg', 'uploads/marketplace/b.jpg', 'uploads/marketplace/c.jpg']

  it('keeps the cover photo selected when photos are reordered', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<MarketplacePhotoUploader photos={photos} coverIndex={0} onChange={onChange} />)

    await user.click(screen.getAllByRole('button', { name: 'Move photo later' })[0] as HTMLElement)

    expect(onChange).toHaveBeenCalledWith({
      photos: ['uploads/marketplace/b.jpg', 'uploads/marketplace/a.jpg', 'uploads/marketplace/c.jpg'],
      coverIndex: 1,
    })
  })

  it('sets a new cover and moves the cover when the cover photo is deleted', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<MarketplacePhotoUploader photos={photos} coverIndex={2} onChange={onChange} />)

    await user.click(screen.getAllByRole('button', { name: 'Cover' })[0] as HTMLElement)
    expect(onChange).toHaveBeenLastCalledWith({ photos, coverIndex: 0 })

    await user.click(screen.getAllByRole('button', { name: 'Remove photo' })[2] as HTMLElement)
    expect(onChange).toHaveBeenLastCalledWith({ photos: photos.slice(0, 2), coverIndex: 0 })
  })

  it('shows the 10 photo limit', () => {
    renderWithProviders(<MarketplacePhotoUploader photos={photos} coverIndex={0} onChange={vi.fn()} />)
    expect(screen.getByText('3 / 10 photos')).toBeInTheDocument()
  })
})

describe('marketplace home page', () => {
  it('renders search, sell action, categories, and listing sections', async () => {
    const home: MarketplaceHome = {
      categories: [
        {
          id: 'c1',
          name: 'Furniture',
          nameMy: 'ပရိဘောဂ',
          slug: 'furniture',
          children: [{ id: 's1', name: 'Bed', nameMy: null, slug: 'furniture-bed' }],
        },
      ],
      recommended: [listing({ id: 'r1', title: 'Used refrigerator' })],
      recommendedForDestinationCityId: null,
      recentlyListed: [listing({ id: 'n1', title: 'Queen mattress' })],
      verifiedSellers: [],
      movingOutSales: [],
    }
    stubFetch({ '/marketplace/home': home, '/master-data/cities': { items: [] } })

    renderWithProviders(<MarketplaceHomePage />, { initialEntries: ['/marketplace'] })

    expect(screen.getByRole('searchbox', { name: 'Search the marketplace' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sell an item/ })).toHaveAttribute('href', '/marketplace/sell')
    await waitFor(() => expect(screen.getByRole('link', { name: /Furniture/ })).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Recommended for you' })).toBeInTheDocument()
    expect(screen.getByText('Used refrigerator')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recently listed' })).toBeInTheDocument()
    expect(screen.getByText('Queen mattress')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Moving soon?' })).toBeInTheDocument()
  })
})
