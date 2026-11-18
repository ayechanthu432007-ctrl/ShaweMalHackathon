import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentBookingsPage } from '@/features/agent/pages/AgentBookingsPage'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

function encodeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

describe('agent bookings page (FR-AGENT-004)', () => {
  afterEach(() => {
    tokenStorage.clear()
    vi.unstubAllGlobals()
  })

  it('lists booker details and can cancel a booking', async () => {
    const token = encodeJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'agent-1',
    })
    tokenStorage.setTokens(token, 'refresh-token', true)

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/verify')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: {
              user: {
                id: 'agent-1',
                name: 'Agent Ada',
                email: 'ada@example.com',
                roles: ['agent'],
                agentVerificationStatus: 'VERIFIED',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/agent/bookings')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: {
              items: [
                {
                  id: 'booking-1',
                  houseId: 'h1',
                  userId: 'user-1',
                  status: 'CONFIRMED',
                  createdAt: new Date().toISOString(),
                  house: { id: 'h1', title: 'River View Condo' },
                  user: { id: 'user-1', name: 'Pat Booker', email: 'pat@example.com', phone: '0911111111' },
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/bookings/booking-1/status') && init?.method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: { booking: { id: 'booking-1', status: 'CANCELLED', cancelledByRole: 'AGENT' } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ success: false, message: `Unhandled ${url}` }), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderWithProviders(<AgentBookingsPage />, { initialEntries: ['/agent/bookings'] })

    expect(await screen.findByText('River View Condo')).toBeInTheDocument()
    expect(screen.getByText('Pat Booker')).toBeInTheDocument()
    expect(screen.getByText('pat@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel booking/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /cancel this booking/i })
    await user.click(within(dialog).getByRole('button', { name: /cancel booking/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/bookings/booking-1/status'), expect.any(Object))
    })
  })
})
