import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AdminLayout } from '@/features/admin/layout/AdminLayout'
import { renderWithProviders } from '@/test/utils'

const renderAt = (path: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="*" element={<p>page</p>} />
      </Route>
    </Routes>,
    { initialEntries: [path] },
  )

describe('admin layout', () => {
  it('lists every admin function in a side bar, outside the top header', () => {
    renderAt('/admin/dashboard')

    const sidebar = screen.getByRole('complementary')
    const links = within(sidebar).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin/dashboard',
      '/admin/master-data',
      '/admin/verifications/agents',
      '/admin/verifications/drivers',
      '/admin/users',
      '/admin/jobs-assign',
      '/admin/marketplace',
      '/admin/subscriptions',
      '/admin/reports/moving',
      '/admin/reports/bookings',
      '/admin/reports',
    ])
    expect(within(screen.getByRole('banner')).queryByRole('link')).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByRole('button', { name: /logout/i })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })

  it('highlights only the report page that is open', () => {
    renderAt('/admin/reports/moving')

    const sidebar = screen.getByRole('complementary')
    const current = within(sidebar)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.getAttribute('href'))).toEqual(['/admin/reports/moving'])
  })
})
