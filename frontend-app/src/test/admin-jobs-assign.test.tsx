import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdminMovingAssignPage } from '@/features/admin/pages/AdminMovingAssignPage'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

function createToken() {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: 'admin',
      sub: 'admin-1',
    }),
  )
  return `${header}.${payload}.sig`
}

function authUserResponse() {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'ok',
      data: { user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', roles: ['admin'] } },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

const bookedJob = {
  id: 'moving-booked',
  orderNumber: 'MOV-20260817-000001',
  status: 'BOOKED',
  pickupAddress: 'Hledan, Yangon',
  dropoffAddress: 'Tamwe, Yangon',
  moveInDate: '2026-09-01T09:00:00.000Z',
  estimatedPrice: 28500,
  requester: { id: 'u1', name: 'Pat Requester', phone: '091111111', email: 'pat@example.com' },
  assignedDriver: null,
  photos: [],
  inventoryItems: [],
  statusEvents: [],
}

const cancelledJob = {
  id: 'moving-cancelled',
  orderNumber: 'MOV-20260817-000002',
  status: 'CANCELLED',
  pickupAddress: 'Kamayut, Yangon',
  dropoffAddress: 'Bahan, Yangon',
  moveInDate: '2026-09-02T09:00:00.000Z',
  estimatedPrice: 30000,
  requester: { id: 'u2', name: 'Sam Requester', phone: '092222222', email: 'sam@example.com' },
  assignedDriver: { id: 'driver-2', name: 'Driver Two' },
  photos: [],
  inventoryItems: [],
  statusEvents: [
    {
      id: 'e1',
      eventType: 'STATUS_UPDATED',
      status: 'CANCELLED',
      notes: 'Vehicle breakdown',
      createdAt: '2026-08-17T08:00:00.000Z',
    },
  ],
}

describe('admin jobs assign (FR-MOVE-005)', () => {
  afterEach(() => {
    tokenStorage.clear()
    vi.unstubAllGlobals()
  })

  it('lists assignable jobs, searches by order number, and assigns a chosen driver', async () => {
    tokenStorage.setAccessToken(createToken())
    let jobs = [bookedJob, cancelledJob]

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/verify') || url.includes('/auth/me')) {
        return authUserResponse()
      }
      if (url.includes('/admin/moving/assignable-drivers')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: {
              items: [
                {
                  userId: 'driver-1',
                  name: 'Driver One',
                  email: 'driver1@example.com',
                  phone: '0933333333',
                  vehicleTypeName: '10 ft truck',
                  vehicleLicensePlateNumber: 'YGN 7J-1234',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/admin/moving/assignable-requests')) {
        const requestedOrder = new URL(url, 'http://localhost').searchParams.get('orderNumber')
        const items = requestedOrder ? jobs.filter((job) => job.orderNumber.includes(requestedOrder)) : jobs
        return new Response(
          JSON.stringify({ success: true, message: 'ok', data: { items } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/admin/moving/requests/moving-booked/assign') && init?.method === 'POST') {
        jobs = jobs.filter((job) => job.id !== 'moving-booked')
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: { movingRequest: { ...bookedJob, status: 'ASSIGNED' } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ success: false, message: `Unhandled ${url}` }), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderWithProviders(<AdminMovingAssignPage />, { initialEntries: ['/admin/jobs-assign'] })

    expect(await screen.findByRole('heading', { name: /jobs assign/i })).toBeInTheDocument()
    expect(await screen.findByText('MOV-20260817-000001')).toBeInTheDocument()
    expect(screen.getByText('MOV-20260817-000002')).toBeInTheDocument()
    expect(screen.getByText(/vehicle breakdown/i)).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Order number' }), 'MOV-20260817-000001')
    await user.click(screen.getByRole('button', { name: /^apply filters$/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('orderNumber=MOV-20260817-000001'),
        expect.any(Object),
      )
    })

    const bookedRow = within(screen.getByRole('table')).getByText('MOV-20260817-000001').closest('tr') as HTMLElement
    await user.selectOptions(within(bookedRow).getByLabelText(/choose driver/i), 'driver-1')
    await user.click(within(bookedRow).getByRole('button', { name: /assign driver/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/moving/requests/moving-booked/assign'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(await screen.findByText(/job assigned successfully/i)).toBeInTheDocument()
  })
})
