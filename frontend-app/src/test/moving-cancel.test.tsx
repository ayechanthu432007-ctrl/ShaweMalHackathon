import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MovingStatusCurrentStatusCard } from '@/features/moving/components/MovingStatusCurrentStatusCard'
import { movingApi } from '@/features/moving/api/moving-api'
import type { MovingRequest } from '@/features/moving/types'
import { renderWithProviders } from '@/test/utils'

const booking = (overrides: Partial<MovingRequest> = {}): MovingRequest => ({
  id: 'move-7',
  orderNumber: 'MOV-20261014-000007',
  status: 'BOOKED',
  pickupAddress: 'Ahlon, Yangon',
  dropoffAddress: 'Bahan, Yangon',
  moveInDate: '2026-10-16T00:00:00.000Z',
  assignedDriver: null,
  photos: [],
  inventoryItems: [],
  ...overrides,
})

/** Renders the bar from the same query the page uses, so a cancel updates what is shown. */
function Page({ initial }: { initial: MovingRequest }) {
  const query = useQuery({ queryKey: ['moving-request', initial.id], queryFn: () => movingApi.getById(initial.id), initialData: { movingRequest: initial }, staleTime: Infinity })
  return <MovingStatusCurrentStatusCard request={query.data.movingRequest} />
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status < 400 ? { success: true, message: 'ok', data } : { success: false, message: data, errors: { code: 'MOVING_REQUEST_NOT_CANCELLABLE' } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('customer cancels a moving booking', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is offered only while the booking is waiting for a driver', () => {
    const { unmount } = renderWithProviders(<Page initial={booking()} />)
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument()
    unmount()

    for (const status of ['ACCEPTED', 'ASSIGNED', 'DRIVER_COMING', 'LOADING', 'COMPLETED', 'CANCELLED']) {
      const view = renderWithProviders(<Page initial={booking({ id: `m-${status}`, status, assignedDriver: { id: 'd', name: 'U Hla' } })} />)
      expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('keeps the booking when the customer chooses Keep Booking', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderWithProviders(<Page initial={booking()} />)

    await user.click(screen.getByRole('button', { name: /cancel booking/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Are you sure you want to cancel this moving booking?')
    expect(dialog).toHaveTextContent('MOV-20261014-000007')

    await user.click(screen.getByRole('button', { name: 'Keep Booking' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels once, then shows Cancelled and removes the button', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/moving/requests/move-7/cancel')) {
          calls += 1
          return json({ movingRequest: booking({ status: 'CANCELLED' }) })
        }
        return json({ items: [] })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<Page initial={booking()} />)

    await user.click(screen.getByRole('button', { name: /cancel booking/i }))
    const confirm = screen.getByRole('button', { name: 'Confirm Cancellation' })
    await user.dblClick(confirm)

    expect(await screen.findByText('Your booking has been cancelled successfully.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cancelled' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
    expect(calls).toBe(1)
  })

  it('explains when a driver was assigned first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('/cancel')
          ? json('A driver has already been assigned, so this booking can no longer be cancelled here.', 409)
          : json({ movingRequest: booking() }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<Page initial={booking()} />)

    await user.click(screen.getByRole('button', { name: /cancel booking/i }))
    await user.click(screen.getByRole('button', { name: 'Confirm Cancellation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/can no longer be cancelled/)
  })
})
