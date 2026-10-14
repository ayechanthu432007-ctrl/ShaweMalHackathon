import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MovingStatusBookingList } from '@/features/moving/components/MovingStatusBookingList'
import { MovingReceiptPage } from '@/features/moving/pages/MovingReceiptPage'
import type { MovingRequest } from '@/features/moving/types'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

const base = (overrides: Partial<MovingRequest>): MovingRequest => ({
  id: 'm',
  status: 'BOOKED',
  pickupAddress: 'Hlaing, Yangon',
  dropoffAddress: 'Bahan, Yangon',
  moveInDate: '2026-10-16T00:00:00.000Z',
  photos: [],
  inventoryItems: [],
  ...overrides,
})

const completed = base({
  id: 'done-1',
  orderNumber: 'MOV-20261001-000004',
  status: 'COMPLETED',
  distanceKm: 12.5,
  pricePerKmUsed: 600,
  pickupFloorSurcharge: 15000,
  dropoffFloorSurcharge: 10000,
  estimatedPrice: 32500,
  vehicleType: { id: 'v', name: 'Mini Pickup' },
  assignedDriver: { id: 'd', name: 'Ko Min Naing' },
  statusEvents: [{ id: 'e', eventType: 'STATUS_UPDATED', status: 'COMPLETED', createdAt: '2026-10-02T09:00:00.000Z' }] as never,
})

function createToken() {
  const payload = btoa(JSON.stringify({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }))
  return `x.${payload}.y`
}

describe('moving bookings split into active and completed', () => {
  it('keeps completed moves out of the active column and links them to their receipt', () => {
    renderWithProviders(
      <MovingStatusBookingList
        items={[
          base({ id: 'a1', orderNumber: 'MOV-A1', status: 'DRIVER_COMING' }),
          completed,
          base({ id: 'c1', orderNumber: 'MOV-C1', status: 'CANCELLED' }),
        ]}
      />,
    )

    const active = screen.getByRole('heading', { name: /^Active/ }).parentElement as HTMLElement
    const done = screen.getByRole('heading', { name: /^Completed/ }).parentElement as HTMLElement
    expect(within(active).getByText('MOV-A1')).toBeInTheDocument()
    expect(within(active).queryByText('MOV-20261001-000004')).not.toBeInTheDocument()
    expect(within(active).getByRole('link', { name: 'Check Status' })).toHaveAttribute('href', '/moving-status/a1')
    expect(within(done).getByText('MOV-20261001-000004')).toBeInTheDocument()
    expect(within(done).getByText('Completed', { selector: 'span' })).toBeInTheDocument()
    expect(within(done).getByRole('link', { name: 'View Receipt' })).toHaveAttribute('href', '/moving-status/done-1/receipt')
    expect(within(done).queryByText('MOV-C1')).not.toBeInTheDocument()
  })
})

describe('moving completion receipt', () => {
  let request: MovingRequest = completed
  beforeEach(() => {
    tokenStorage.setTokens(createToken(), 'refresh', true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        const json = (data: unknown) => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        if (url.includes('/auth/')) return json({ user: { id: 'user-1', name: 'Aung', email: 'a@example.test', roles: ['normal'] } })
        if (url.includes(`/moving/requests/${request.id}`)) return json({ movingRequest: request })
        return new Response('{}', { status: 404 })
      }),
    )
  })
  afterEach(() => {
    tokenStorage.clear()
    vi.unstubAllGlobals()
  })

  const renderReceipt = (id: string) =>
    renderWithProviders(
      <Routes>
        <Route path="/moving-status/:id/receipt" element={<MovingReceiptPage />} />
        <Route path="/moving-status/:id" element={<p>tracking page</p>} />
      </Routes>,
      { initialEntries: [`/moving-status/${id}/receipt`] },
    )

  it('shows the booking’s own figures and never a payment status', async () => {
    request = completed
    renderReceipt('done-1')

    expect(await screen.findByRole('heading', { name: 'Moving Completion Receipt' })).toBeInTheDocument()
    expect(screen.getAllByText('MMK 32,500')).toHaveLength(2)
    const rows = Object.fromEntries(
      screen.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]),
    )
    expect(rows).toMatchObject({
      'Moving Number': 'MOV-20261001-000004',
      'Driver name': 'Ko Min Naing',
      'Selected Vehicle': 'Mini Pickup',
      'Pickup Location': 'Hlaing, Yangon',
      Destination: 'Bahan, Yangon',
      'Total Distance': '12.5 km',
      'Cost per Distance': 'MMK 600 / km',
      'Moving Cost': 'MMK 7,500',
      'Additional Charges (floors)': 'MMK 25,000',
    })
    expect(rows['Completion Date']).toMatch(/2026/)
    expect(screen.queryByText(/payment|paid|unpaid|pending/i)).not.toBeInTheDocument()
  })

  it('leaves out rows the booking has no data for', async () => {
    request = base({ id: 'done-2', orderNumber: 'MOV-2', status: 'COMPLETED', estimatedPrice: 20000 })
    renderReceipt('done-2')

    expect(await screen.findByText('MOV-2')).toBeInTheDocument()
    const labels = screen.getAllByRole('term').map((term) => term.textContent)
    for (const missing of ['Driver name', 'Selected Vehicle', 'Total Distance', 'Cost per Distance', 'Moving Cost', 'Additional Charges (floors)']) {
      expect(labels).not.toContain(missing)
    }
  })

  it('sends a move that is not finished back to tracking', async () => {
    request = base({ id: 'live-1', status: 'LOADING' })
    renderReceipt('live-1')

    expect(await screen.findByText(/available once this move is completed/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Check Status' })).toHaveAttribute('href', '/moving-status/live-1')
  })
})
