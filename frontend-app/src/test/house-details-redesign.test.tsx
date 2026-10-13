import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HouseDetailsPage } from '@/features/houses/pages/HouseDetailsPage'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/features/houses/components/HouseLocationMap', () => ({
  HouseLocationMap: () => <div data-testid="house-location-map" />,
}))

const house = {
  id: 'h1',
  title: 'Inya Garden Flat',
  description: 'Bright corner unit.',
  availability: 'AVAILABLE',
  monthlyFees: 600000,
  depositAmount: 400000,
  areaSize: '500 sqft',
  bedrooms: 1,
  bathrooms: 1,
  images: [{ id: 'i1', imagePath: 'https://img.test/1.jpg' }, { id: 'i2', imagePath: 'https://img.test/2.jpg' }],
  amenities: [
    { id: 'a-wifi', name: 'WIFI' },
    { id: 'a-air', name: 'AIR CONDITIONER' },
  ],
  contact: { phone: '0911111111' },
  location: { city: { id: 'c1', name: 'Bahan' }, state: { id: 's1', name: 'Yangon' }, streetAddress: '42 Inya Road', nearbyPlaces: 'School, Hospital' },
  propertyType: { id: 'p1', name: 'Apartment' },
  contractType: { id: 'ct1', name: '1 Year' },
  floorLevel: { id: 'f1', name: '6th Floor' },
  agent: { id: 'a1', name: 'Agent Ada', phone: '0922222222' },
}

const related = [
  { id: 'h2', title: 'Nearby Condo', monthlyFees: 650000, availability: 'AVAILABLE', city: { id: 'c1', name: 'Bahan' }, propertyType: { id: 'p1', name: 'Apartment' }, bedrooms: 2, bathrooms: 1, thumbnail: null },
  // The server never returns the listing itself, but the page guards against it anyway.
  { id: 'h1', title: 'Inya Garden Flat', monthlyFees: 600000, availability: 'AVAILABLE' },
]

let requested: string[] = []

describe('house details page', () => {
  beforeEach(() => {
    requested = []
    localStorage.clear()
    sessionStorage.clear()
    const json = (data: unknown) => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        requested.push(url)
        if (url.includes('/houses/h1/related')) return json({ items: related })
        if (url.includes('/houses/h1/events')) return json({ recorded: true })
        if (url.includes('/houses/h1')) return json({ item: house })
        if (url.includes('/master-data/amenities')) return json({ items: [{ id: 'a-wifi', name: 'WIFI' }, { id: 'a-air', name: 'AIR CONDITIONER' }, { id: 'a-pool', name: 'POOL' }, { id: 'a-lift', name: 'LIFT' }] })
        return new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  const renderPage = () =>
    renderWithProviders(
      <Routes>
        <Route path="/houses/:id" element={<HouseDetailsPage />} />
        <Route path="/sign-in" element={<p>sign in page</p>} />
      </Routes>,
      { initialEntries: ['/houses/h1'] },
    )

  it('presents the listing with its price, key facts, room type, amenities and actions', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Inya Garden Flat' })).toBeInTheDocument()
    expect(screen.getByText('42 Inya Road, Bahan, Yangon')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Finding House' })).toHaveAttribute('href', '/finding-house')

    // Price and actions together.
    expect(screen.getByText('Rental rate')).toBeInTheDocument()
    expect(screen.getAllByText('600,000 MMK').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Book house' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contact Agent' })).toHaveAttribute('href', 'tel:0911111111')

    // Room type table carries the real values of this listing.
    const roomType = screen.getByRole('table')
    expect(within(roomType).getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    const row = within(roomType).getAllByRole('row')[1] as HTMLElement
    expect(row).toHaveTextContent('Apartment')
    expect(row).toHaveTextContent('1 bed · 1 bath')
    expect(row).toHaveTextContent('500 sqft')
    expect(row).toHaveTextContent('1 Year')

    // Amenities the home has, and separately the ones it does not.
    const included = await screen.findByRole('list', { name: 'Included' })
    expect(within(included).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Wi-Fi', 'Air Conditioner'])
    const missing = await screen.findByRole('list', { name: 'Not included' })
    expect(within(missing).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Pool', 'Lift'])

    // Internet is stated only because the listing has Wi-Fi.
    expect(screen.getByText('Wi-Fi included')).toBeInTheDocument()
    expect(screen.getByText('School')).toBeInTheDocument()
    expect(screen.getByText('Hospital')).toBeInTheDocument()
  })

  it('links to related listings and never lists the home itself', async () => {
    renderPage()

    const section = (await screen.findByRole('heading', { name: 'Related properties' })).closest('section') as HTMLElement
    const links = within(section).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/houses/h2'])
    expect(within(section).getByText('Nearby Condo')).toBeInTheDocument()
    expect(requested.filter((url) => url.includes('/related'))).toHaveLength(1)
  })

  it('sends a signed-out visitor to sign in when they try to book', async () => {
    renderPage()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Book house' }))

    expect(await screen.findByText('sign in page')).toBeInTheDocument()
  })

  it('copies the page link when sharing is not offered by the device', async () => {
    // The test library installs its own clipboard on setup, so ours goes in afterwards.
    const user = userEvent.setup()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Share' }))

    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(await screen.findByText(/link copied/i)).toBeInTheDocument()
  })
})
