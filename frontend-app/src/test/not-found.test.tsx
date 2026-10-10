import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { NotFoundPage } from '@/components/common/NotFoundPage'
import { publicRoutes } from '@/app/router/public-routes'
import { renderWithProviders } from '@/test/utils'

describe('unknown addresses', () => {
  it('registers a catch-all route so unknown addresses do not crash the app', () => {
    expect(publicRoutes.children?.at(-1)).toMatchObject({ path: '*' })
  })

  it('shows a not-found page with a way back home', async () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>,
      { initialEntries: ['/roommates'] },
    )

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/')
  })
})
