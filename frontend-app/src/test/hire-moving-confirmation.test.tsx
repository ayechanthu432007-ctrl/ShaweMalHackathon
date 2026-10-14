import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HireMovingStepConfirmation } from '@/features/moving/components/HireMovingStepConfirmation'
import type { MovingRequest } from '@/features/moving/types'
import { renderWithProviders } from '@/test/utils'

const saved: MovingRequest = {
  id: 'moving-1',
  orderNumber: 'MOV-20260815-000001',
  status: 'PENDING',
  pickupAddress: 'No. 12, Inya Road, Kamayut Township, Yangon',
  dropoffAddress: 'No. 5, Bahan 3rd Street, Bahan Township, Yangon',
  moveInDate: '2026-11-20T00:00:00.000Z',
  estimatedPrice: 26680,
  vehicleType: { id: 'v1', name: 'Tuk-Tuk / Three-Wheeler' },
  requester: { id: 'u1', name: 'Aung Aung', phone: '0911111111', email: 'aung@example.com' },
  photos: [],
  inventoryItems: [],
}

describe('hire moving confirmation', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stubServer = (request: MovingRequest | null) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      request
        ? new Response(JSON.stringify({ success: true, message: 'ok', data: { movingRequest: request } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : new Response(JSON.stringify({ success: false, message: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('lists the booking details, then the order and contact box, then the actions', async () => {
    stubServer(saved)
    renderWithProviders(<HireMovingStepConfirmation requestId="moving-1" initial={saved} />)

    const details = screen.getByText(saved.pickupAddress).closest('dl') as HTMLElement
    expect(within(details).getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Pick up address',
      'Drop off address',
      'Vehicle type',
      'Total price',
      'Move-in date',
    ])
    expect(within(details).getByText(saved.pickupAddress)).toBeInTheDocument()
    expect(within(details).getByText(saved.dropoffAddress)).toBeInTheDocument()
    expect(within(details).getByText('Tuk-Tuk / Three-Wheeler')).toBeInTheDocument()
    expect(within(details).getByText('26,680 MMK')).toBeInTheDocument()
    expect(within(details).getByText(/2026/)).toBeInTheDocument()

    const box = screen.getByText('MOV-20260815-000001').closest('dl') as HTMLElement
    expect(within(box).getAllByRole('term').map((term) => term.textContent)).toEqual(['Order number', 'Name', 'Phone', 'Email'])
    expect(within(box).getByText('Aung Aung')).toBeInTheDocument()
    expect(within(box).getByText('0911111111')).toBeInTheDocument()
    expect(within(box).getByText('aung@example.com')).toBeInTheDocument()
    expect(details.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(screen.getByText(/The assigned driver may contact you using above contact information/)).toBeInTheDocument()
    const track = screen.getByRole('link', { name: /track status/i })
    expect(track).toHaveAttribute('href', '/moving-status/moving-1')
    expect(box.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('reads the booking back by id after a refresh', async () => {
    const fetchMock = stubServer(saved)
    renderWithProviders(<HireMovingStepConfirmation requestId="moving-1" />)

    expect(await screen.findByText('MOV-20260815-000001')).toBeInTheDocument()
    expect(screen.getByText('26,680 MMK')).toBeInTheDocument()
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/moving/requests/moving-1')
  })
})
