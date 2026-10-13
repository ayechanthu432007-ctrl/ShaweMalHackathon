import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AgentContactCard } from '@/features/houses/components/AgentContactCard'
import { HouseCard } from '@/features/houses/components/HouseCard'
import { HouseGallery } from '@/features/houses/components/HouseGallery'
import { amenityLabel, splitNearbyPlaces } from '@/features/houses/components/house-icons'
import { renderWithProviders } from '@/test/utils'

describe('house presentation', () => {
  it('shows price, location, type and the room facts on a listing card that opens the details page', () => {
    renderWithProviders(
      <HouseCard
        house={{
          id: 'h1',
          title: 'Golden Condo',
          monthlyFees: 600000,
          availability: 'available',
          city: { id: 'c', name: 'Bahan' },
          propertyType: { id: 'p', name: 'Apartment' },
          bedrooms: 1,
          bathrooms: 2,
          areaSize: '500 sqft',
        }}
      />,
    )

    const card = screen.getByRole('link', { name: /golden condo/i })
    expect(card).toHaveAttribute('href', '/houses/h1')
    expect(within(card).getByText('600,000 MMK')).toBeInTheDocument()
    expect(within(card).getByText('/ month')).toBeInTheDocument()
    expect(within(card).getByText('Bahan')).toBeInTheDocument()
    expect(within(card).getByText('Apartment')).toBeInTheDocument()
    expect(within(card).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['1 bed', '2 baths', '500 sqft'])
    expect(screen.getByRole('button', { name: 'Add to wishlist' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('leaves out facts the listing does not have', () => {
    renderWithProviders(<HouseCard house={{ id: 'h2', title: 'Bare Listing', monthlyFees: 100000 }} />)

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByText('Location unavailable')).toBeInTheDocument()
  })

  it('makes the agent reachable by phone, email, Telegram and Viber', () => {
    renderWithProviders(
      <AgentContactCard
        house={{
          id: 'h1',
          agent: { id: 'a1', name: 'Mg Mg', phone: '09-442074638', email: 'agent@example.com' },
          contact: { phone: '09 555 666', telegram: '@mgmg', viber: '+959111222333' },
        }}
      />,
    )

    expect(screen.getByText('Mg Mg')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '09-442074638' })).toHaveAttribute('href', 'tel:09442074638')
    expect(screen.getByRole('link', { name: 'agent@example.com' })).toHaveAttribute('href', 'mailto:agent@example.com')
    // The main action calls the number given for this listing.
    expect(screen.getByRole('link', { name: 'Contact Agent' })).toHaveAttribute('href', 'tel:09555666')
    expect(screen.getByRole('link', { name: 'Telegram' })).toHaveAttribute('href', expect.stringContaining('t.me/mgmg'))
    expect(screen.getByRole('link', { name: 'Viber' })).toHaveAttribute('href', expect.stringContaining('viber://'))
  })

  it('shows only the contact details the agent has', () => {
    renderWithProviders(<AgentContactCard house={{ id: 'h1', agent: { id: 'a1', name: 'Solo Agent' }, contact: {} }} />)

    expect(screen.getByText('Solo Agent')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('opens a full-screen viewer from any photo, with a counter and previous/next navigation', async () => {
    const user = userEvent.setup()
    const images = [1, 2, 3].map((n) => ({ imagePath: `https://img.test/${n}.jpg` }))
    renderWithProviders(<HouseGallery title="Golden Condo" images={images} />)

    // The first photo is the large one on the page; no viewer is open yet.
    expect(screen.getByRole('img', { name: 'Golden Condo' })).toHaveAttribute('src', 'https://img.test/1.jpg')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View all 3 photos' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open photo 2 of 3' }))
    const viewer = screen.getByRole('dialog', { name: 'Photos of Golden Condo' })
    expect(within(viewer).getByText('2 / 3')).toBeInTheDocument()
    expect(within(viewer).getByRole('img', { name: 'Photo 2 of Golden Condo' })).toHaveAttribute('src', 'https://img.test/2.jpg')

    await user.click(within(viewer).getByRole('button', { name: 'Next photo' }))
    expect(within(viewer).getByText('3 / 3')).toBeInTheDocument()
    // Going past the last photo wraps to the first.
    await user.click(within(viewer).getByRole('button', { name: 'Next photo' }))
    expect(within(viewer).getByText('1 / 3')).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(within(viewer).getByText('3 / 3')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a placeholder only when the listing has no photos', () => {
    renderWithProviders(<HouseGallery title="Bare Listing" images={[]} />)

    expect(screen.getByText('No photo')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('tidies amenity names and splits the nearby places text', () => {
    expect(amenityLabel('AIR CONDITIONER')).toBe('Air Conditioner')
    expect(amenityLabel('WIFI')).toBe('Wi-Fi')
    expect(amenityLabel('CCTV')).toBe('CCTV')
    expect(splitNearbyPlaces('School, Hospital')).toEqual(['School', 'Hospital'])
    expect(splitNearbyPlaces(null)).toEqual([])
  })
})
