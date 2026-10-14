import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { MovingStatusListPage } from '@/features/moving/pages/MovingStatusListPage'
import { MovingStatusPage } from '@/features/moving/pages/MovingStatusPage'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

function createToken() {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-1',
    }),
  )
  return `${header}.${payload}.sig`
}

function movingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'move-1',
    orderNumber: 'MOV-20260816-000001',
    status: 'DRIVER_COMING',
    pickupAddress: 'Hlaing Township, Yangon',
    dropoffAddress: 'Kamayut Township, Yangon',
    moveInDate: '2026-08-20T07:00:00.000Z',
    totalInventoryPoints: 44,
    estimatedPrice: 120000,
    vehicleType: { id: 'vt-1', name: 'Mini Truck', capacityLabel: '20–35 boxes' },
    assignedDriver: {
      id: 'driver-1',
      name: 'Ko Min Naing',
      phone: '09450123456',
      email: 'minnaing@example.com',
      driverProfile: {
        name: 'Ko Min Naing',
        phone: '09450123456',
        profilePhotoPath: 'uploads/profile/driver-1.jpg',
        vehicleLicensePlateNumber: 'YGN 7J-1234',
      },
    },
    photos: [],
    inventoryItems: [],
    statusEvents: [
      { id: 'e1', eventType: 'CREATED', status: 'BOOKED', createdAt: '2026-08-20T03:30:00.000Z' },
      { id: 'e2', eventType: 'ACCEPTED', status: 'ACCEPTED', createdAt: '2026-08-20T04:00:00.000Z' },
      { id: 'e3', eventType: 'STATUS_UPDATED', status: 'DRIVER_COMING', createdAt: '2026-08-20T04:10:00.000Z' },
    ],
    etaEntries: [{ id: 'eta-1', stage: 'driver_coming', etaAt: '2026-08-20T07:15:00.000Z', createdAt: '2026-08-20T04:10:00.000Z' }],
    updatedAt: '2026-08-16T01:00:00.000Z',
    ...overrides,
  }
}

function renderMovingStatusRoutes(path = '/moving-status') {
  return renderWithProviders(
    <Routes>
      <Route path="/moving-status" element={<MovingStatusListPage />} />
      <Route path="/moving-status/:id" element={<MovingStatusPage />} />
      <Route path="/hire-moving/:id" element={<p>details</p>} />
    </Routes>,
    { initialEntries: [path] },
  )
}

describe('moving status list page', () => {
  afterEach(() => {
    tokenStorage.clear()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    tokenStorage.setTokens(createToken(), 'refresh', true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/auth/verify') || url.includes('/auth/me')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                user: { id: 'user-1', name: 'Aung Aung', email: 'aung@example.com', roles: ['normal'] },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.endsWith('/moving/requests') || url.includes('/moving/requests?')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                items: [
                  movingRequest(),
                  movingRequest({
                    id: 'move-2',
                    orderNumber: 'MOV-20260816-000002',
                    status: 'BOOKED',
                    pickupAddress: 'Bahan Township, Yangon',
                    dropoffAddress: 'Tamwe Township, Yangon',
                    assignedDriver: null,
                    updatedAt: '2026-08-15T01:00:00.000Z',
                  }),
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/moving/requests/move-2')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                movingRequest: movingRequest({
                  id: 'move-2',
                  orderNumber: 'MOV-20260816-000002',
                  status: 'BOOKED',
                  pickupAddress: 'Bahan Township, Yangon',
                  dropoffAddress: 'Tamwe Township, Yangon',
                  assignedDriver: null,
                }),
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/moving/requests/move-1')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: { movingRequest: movingRequest() },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(JSON.stringify({ success: false, message: `Unhandled ${url}` }), { status: 404 })
      }),
    )
  })

  it('lists booking records with a check status action on each panel', async () => {
    renderMovingStatusRoutes()

    expect(await screen.findByText(/MOV-20260816-000001/i)).toBeInTheDocument()
    expect(screen.getByText(/MOV-20260816-000002/i)).toBeInTheDocument()
    expect(screen.getByText(/Hlaing Township, Yangon → Kamayut Township, Yangon/i)).toBeInTheDocument()
    expect(screen.getByText(/Bahan Township, Yangon → Tamwe Township, Yangon/i)).toBeInTheDocument()

    const checkStatusLinks = screen.getAllByRole('link', { name: /check status/i })
    expect(checkStatusLinks).toHaveLength(2)
    expect(checkStatusLinks[0]).toHaveAttribute('href', '/moving-status/move-1')
    expect(checkStatusLinks[1]).toHaveAttribute('href', '/moving-status/move-2')
    expect(screen.queryByText(/Mini Truck/i)).not.toBeInTheDocument()
  })

  it('opens the selected booking status page from check status', async () => {
    const user = userEvent.setup()
    renderMovingStatusRoutes()

    const checkStatusLinks = await screen.findAllByRole('link', { name: /check status/i })
    await user.click(checkStatusLinks[1])

    expect(await screen.findByText(/Bahan Township, Yangon/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /check status/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to bookings/i })).toHaveAttribute('href', '/moving-status')
  })
})

describe('moving status page', () => {
  afterEach(() => {
    tokenStorage.clear()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    tokenStorage.setTokens(createToken(), 'refresh', true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/auth/verify') || url.includes('/auth/me')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                user: { id: 'user-1', name: 'Aung Aung', email: 'aung@example.com', roles: ['normal'] },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/moving/requests/missing')) {
          return new Response(JSON.stringify({ success: false, message: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (url.includes('/moving/requests/move-unassigned')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                movingRequest: movingRequest({
                  id: 'move-unassigned',
                  orderNumber: 'MOV-20260816-000003',
                  status: 'BOOKED',
                  assignedDriver: null,
                }),
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/moving/requests/move-completed')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                movingRequest: movingRequest({
                  id: 'move-completed',
                  orderNumber: 'MOV-20260816-000004',
                  status: 'COMPLETED',
                }),
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/moving/requests/move-1')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: { movingRequest: movingRequest() },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/reviews')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                item: {
                  id: 'review-1',
                  targetType: 'DRIVER',
                  targetUserId: 'driver-1',
                  rating: 5,
                  movingRequestId: 'move-completed',
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(JSON.stringify({ success: false, message: `Unhandled ${url}` }), { status: 404 })
      }),
    )
  })

  it('shows template details without cubic volume or other bookings', async () => {
    renderMovingStatusRoutes('/moving-status/move-1')

    expect(await screen.findByText(/Mini Truck \(20–35 boxes\)/i)).toBeInTheDocument()
    // Items, points, max load and phone are kept in the record but not listed.
    expect(screen.queryByText(/44 pts/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/m³|m3/i)).not.toBeInTheDocument()
    expect(screen.getByText(/YGN 7J-1234/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contact driver/i })).toHaveAttribute('href', 'tel:09450123456')
    expect(screen.getByRole('button', { name: /driver details/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rate driver/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view request details/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/MOV-20260816-000002/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /check status/i })).not.toBeInTheDocument()
  })

  it('opens driver details in a popup', async () => {
    const user = userEvent.setup()
    renderMovingStatusRoutes('/moving-status/move-1')

    await screen.findByRole('button', { name: /driver details/i })
    await user.click(screen.getByRole('button', { name: /driver details/i }))

    const dialog = await screen.findByRole('dialog', { name: /driver details/i })
    expect(dialog).toBeInTheDocument()
    expect(screen.getAllByText(/Ko Min Naing/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '09450123456' })).toHaveAttribute('href', 'tel:09450123456')
    expect(screen.getByRole('link', { name: 'minnaing@example.com' })).toHaveAttribute(
      'href',
      'mailto:minnaing@example.com',
    )
    expect(screen.getAllByText(/YGN 7J-1234/).length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: /Ko Min Naing/i })).toHaveAttribute(
      'src',
      'http://localhost:4000/uploads/profile/driver-1.jpg',
    )

    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog', { name: /driver details/i })).not.toBeInTheDocument()
  })

  it('hides driver details until a driver is assigned', async () => {
    renderMovingStatusRoutes('/moving-status/move-unassigned')

    expect(await screen.findByText(/MOV-20260816-000003/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /driver details/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rate driver/i })).not.toBeInTheDocument()
  })

  it('opens a driver rating popup after the move is completed', async () => {
    const user = userEvent.setup()
    renderMovingStatusRoutes('/moving-status/move-completed')

    expect(await screen.findByRole('button', { name: /rate driver/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /rate your driver/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /rate driver/i }))

    expect(await screen.findByRole('dialog', { name: /rate your driver, Ko Min Naing/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /5 star/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit rating/i })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /5 star/i }))
    await user.click(screen.getByRole('button', { name: /submit rating/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /rate your driver/i })).not.toBeInTheDocument()
    })
  })

  it('shows not found when the booking does not exist', async () => {
    renderMovingStatusRoutes('/moving-status/missing')

    expect(await screen.findByText(/that moving booking was not found/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to bookings/i })).toHaveAttribute('href', '/moving-status')
  })
})

describe('moving status empty state', () => {
  afterEach(() => {
    tokenStorage.clear()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    tokenStorage.setTokens(createToken(), 'refresh', true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/verify') || url.includes('/auth/me')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: { user: { id: 'user-1', name: 'Aung Aung', email: 'aung@example.com', roles: ['normal'] } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/moving/requests')) {
          return new Response(
            JSON.stringify({ success: true, message: 'ok', data: { items: [] } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(JSON.stringify({ success: false, message: `Unhandled ${url}` }), { status: 404 })
      }),
    )
  })

  it('shows an empty state with hire moving link', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/moving-status" element={<MovingStatusListPage />} />
      </Routes>,
      { initialEntries: ['/moving-status'] },
    )

    expect(await screen.findByText(/you do not have any moving bookings yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /hire moving service/i })).toHaveAttribute('href', '/hire-moving')
  })
})
