import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdminVerificationDetailPage } from '@/features/admin/pages/AdminVerificationDetailPage'
import { AdminVerificationQueuePage } from '@/features/admin/pages/AdminVerificationQueuePage'
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

const agentItem = {
  userId: 'agent-1',
  name: 'Agent Ada',
  email: 'ada@example.com',
  phone: '0911111111',
  nrc: '12/YGN(N)123456',
  city: { id: 'city-1', name: 'Yangon' },
  state: { id: 'state-1', name: 'Yangon Region' },
  serviceRegion: { id: 'region-1', name: 'Downtown' },
  hasRentingExperience: true,
  submittedAt: '2026-08-01T00:00:00.000Z',
  verificationStatus: 'PENDING',
}

describe('admin agent verification queue (FR-ADMIN-001)', () => {
  afterEach(() => {
    tokenStorage.clear()
    vi.unstubAllGlobals()
  })

  it('lists pending agents without a user-id field', async () => {
    tokenStorage.setAccessToken(createToken())

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/verify') || url.includes('/auth/me')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: { user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', roles: ['admin'] } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/admin/agents?')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: { items: [agentItem], page: 1, pageSize: 20, total: 1, totalPages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ success: false, message: `Unhandled ${url}` }), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<AdminVerificationQueuePage kind="agent" />, {
      initialEntries: ['/admin/verifications/agents'],
    })

    expect(await screen.findByRole('heading', { name: /agent verification/i })).toBeInTheDocument()
    expect(await screen.findByText('Agent Ada')).toBeInTheDocument()
    expect(screen.getByText('12/YGN(N)123456')).toBeInTheDocument()
    expect(screen.queryByLabelText(/user id/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute(
      'href',
      '/admin/verifications/agents/agent-1',
    )
  })
})

describe('admin agent verification detail (FR-ADMIN-001)', () => {
  afterEach(() => {
    tokenStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows registration details and can approve', async () => {
    tokenStorage.setAccessToken(createToken())

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/verify') || url.includes('/auth/me')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: { user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', roles: ['admin'] } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/admin/agents/agent-1/verification') && init?.method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: {
              user: {
                id: 'agent-1',
                name: 'Agent Ada',
                email: 'ada@example.com',
                phone: '0911111111',
                roles: ['agent'],
                agentVerificationStatus: 'VERIFIED',
                driverVerificationStatus: null,
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/admin/agents/agent-1')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'ok',
            data: {
              user: {
                id: 'agent-1',
                name: 'Agent Ada',
                email: 'ada@example.com',
                phone: '0911111111',
                roles: ['agent'],
                agentVerificationStatus: 'PENDING',
                driverVerificationStatus: null,
              },
              profile: {
                id: 'ap-1',
                name: 'Agent Ada',
                nrc: '12/YGN(N)123456',
                nrcFrontPhotoPath: 'uploads/docs/nrc-front.jpg',
                nrcBackPhotoPath: 'uploads/docs/nrc-back.jpg',
                email: 'ada@example.com',
                phone: '0911111111',
                address1: 'Street 1',
                cityId: 'city-1',
                stateId: 'state-1',
                serviceRegionId: 'region-1',
                city: { id: 'city-1', name: 'Yangon' },
                state: { id: 'state-1', name: 'Yangon Region' },
                serviceRegion: { id: 'region-1', name: 'Downtown' },
                hasRentingExperience: true,
                verificationStatus: 'PENDING',
                submittedAt: '2026-08-01T00:00:00.000Z',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ success: false, message: `Unhandled ${url}` }), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route
          path="/admin/verifications/agents/:userId"
          element={<AdminVerificationDetailPage kind="agent" />}
        />
      </Routes>,
      {
        initialEntries: ['/admin/verifications/agents/agent-1'],
      },
    )

    expect(await screen.findByText('12/YGN(N)123456')).toBeInTheDocument()
    expect(screen.getByText('Yangon')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^approve$/i }))

    const dialog = await screen.findByRole('alertdialog', { name: /approve this registration/i })
    expect(within(dialog).getByText('Agent Ada')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^approve$/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/agents/agent-1/verification'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })
  })
})
