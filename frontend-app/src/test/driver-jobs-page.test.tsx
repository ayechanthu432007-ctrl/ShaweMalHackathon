import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DriverJobsPage } from '@/features/driver/pages/DriverJobsPage'
import { tokenStorage } from '@/lib/auth/token-storage'
import { renderWithProviders } from '@/test/utils'

function encodeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

function jobItem(overrides: Record<string, unknown>) {
  return {
    orderNumber: 'MOV-1',
    pickupAddress: 'Pickup Road',
    dropoffAddress: 'Dropoff Road',
    moveInDate: '2026-09-15T00:00:00.000Z',
    estimatedEarnings: 45000,
    photos: [],
    inventoryItems: [],
    ...overrides,
  }
}

function expectMoveInDateBeforeEarnings(container: HTMLElement) {
  const text = container.textContent ?? ''
  const moveInIndex = text.toLowerCase().indexOf('move-in date')
  const earningsIndex = text.toLowerCase().indexOf('estimated earnings')
  expect(moveInIndex).toBeGreaterThanOrEqual(0)
  expect(earningsIndex).toBeGreaterThan(moveInIndex)
}

function renderJobsPage(path = '/driver/jobs') {
  return renderWithProviders(
    <Routes>
      <Route path="/driver/jobs" element={<DriverJobsPage />} />
      <Route path="/driver/jobs/:id" element={<DriverJobsPage />} />
    </Routes>,
    { initialEntries: [path] },
  )
}

describe('driver jobs inbox', () => {
  beforeEach(() => {
    tokenStorage.clear()
    const token = encodeJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'driver-1',
    })
    tokenStorage.setTokens(token, 'refresh-token', true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/auth/verify')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                user: {
                  id: 'driver-1',
                  name: 'Driver Dana',
                  email: 'dana@example.com',
                  roles: ['driver'],
                  driverVerificationStatus: 'VERIFIED',
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/driver/requests/assigned')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                items: [
                  jobItem({
                    id: 'assigned-1',
                    orderNumber: 'MOV-ASSIGNED',
                    status: 'DRIVER_COMING',
                    pickupAddress: 'Assigned Pickup',
                    dropoffAddress: 'Assigned Dropoff',
                  }),
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/driver/requests/available')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                items: [
                  jobItem({
                    id: 'available-1',
                    orderNumber: 'MOV-AVAILABLE',
                    status: 'BOOKED',
                    pickupAddress: 'Available Pickup',
                    dropoffAddress: 'Available Dropoff',
                  }),
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('/moving/requests/')) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'ok',
              data: {
                movingRequest: jobItem({
                  id: 'assigned-1',
                  orderNumber: 'MOV-ASSIGNED',
                  status: 'DRIVER_COMING',
                  pickupAddress: 'Assigned Pickup',
                  dropoffAddress: 'Assigned Dropoff',
                  assignedDriver: { id: 'driver-1', name: 'Driver Dana' },
                  requester: { id: 'user-1', name: 'Alice User', phone: '0911111111' },
                }),
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(JSON.stringify({ success: false, message: `Unhandled ${url}` }), {
          status: 404,
        })
      }),
    )
  })

  it('shows assigned jobs first, with available jobs on their own tab', async () => {
    const user = userEvent.setup()
    renderJobsPage()

    const assignedTab = await screen.findByRole('button', { name: /my jobs/i })
    expect(assignedTab).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /available jobs/i })).toBeInTheDocument()

    expect(await screen.findByText('MOV-ASSIGNED')).toBeInTheDocument()
    expect(screen.getAllByText(/driver coming/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /update status/i })).toHaveAttribute('href', '/driver/jobs/assigned-1')
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^reject$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /cancel job/i })).toBeInTheDocument()
    expectMoveInDateBeforeEarnings(screen.getByRole('table'))

    await user.click(screen.getByRole('button', { name: /available jobs/i }))

    expect(await screen.findByText('MOV-AVAILABLE')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute('href', '/driver/jobs/available-1')
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument()
    expect(screen.queryByText('MOV-ASSIGNED')).toBeNull()
    expectMoveInDateBeforeEarnings(screen.getByRole('table'))
  })

  it('shows move-in date before estimated earnings on job details', async () => {
    renderJobsPage('/driver/jobs/assigned-1')

    expect(await screen.findByRole('heading', { level: 1, name: /moving job details/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /delivery status update/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /process eta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark as driver arrived/i })).toBeInTheDocument()

    const detailsCard = screen.getAllByRole('heading', { name: /moving job details/i }).at(-1)?.closest('.rounded-xl')
    expect(detailsCard).not.toBeNull()
    expectMoveInDateBeforeEarnings(detailsCard as HTMLElement)
  })
})
