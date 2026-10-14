import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MovingStatusCurrentStatusCard } from '@/features/moving/components/MovingStatusCurrentStatusCard'
import type { MovingRequest } from '@/features/moving/types'
import { renderWithProviders } from '@/test/utils'

const booking = (status: string): MovingRequest => ({
  id: 'move-42',
  status,
  pickupAddress: 'Ahlon, Yangon',
  dropoffAddress: 'Bahan, Yangon',
  moveInDate: '2026-10-16T00:00:00.000Z',
  assignedDriver: { id: 'd', name: 'U Hla', phone: '09420433047' },
  photos: [],
  inventoryItems: [],
})

describe('View Receipt in the current status bar', () => {
  // Steps 1 to 7 of the move, then step 8.
  it.each(['BOOKED', 'ACCEPTED', 'DRIVER_COMING', 'DRIVER_ARRIVED', 'LOADING', 'ON_THE_WAY', 'UNLOADING'])(
    'is hidden while the move is at %s',
    (status) => {
      renderWithProviders(<MovingStatusCurrentStatusCard request={booking(status)} />)
      expect(screen.queryByRole('link', { name: /view receipt/i })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: /contact driver/i })).toBeInTheDocument()
    },
  )

  it('appears once the move is completed and opens that booking’s receipt', () => {
    renderWithProviders(<MovingStatusCurrentStatusCard request={booking('COMPLETED')} />)
    expect(screen.getByRole('link', { name: /view receipt/i })).toHaveAttribute('href', '/moving-status/move-42/receipt')
    expect(screen.getByRole('link', { name: /contact driver/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /driver details/i })).toBeInTheDocument()
  })
})
