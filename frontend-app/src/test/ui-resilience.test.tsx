import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RouteError } from '@/components/common/RouteError'
import { FeatureHouses } from '@/features/houses/components/FeatureHouses'
import { lazyPage } from '@/app/router/lazy-page'
import { i18n } from '@/lib/i18n'
import { renderWithProviders } from '@/test/utils'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('route error screen', () => {
  it('replaces the developer error page with a friendly message, reload and home actions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function Broken(): never {
      throw new Error('boom')
    }
    const router = createMemoryRouter([{ path: '/', element: <Broken />, errorElement: <RouteError /> }])

    render(
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>,
    )

    expect(await screen.findByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/')
  })
})

describe('featured houses loading state', () => {
  it('keeps the section heading and placeholder cards while loading, so nothing below jumps', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))

    renderWithProviders(<FeatureHouses />)

    expect(screen.getByRole('heading', { name: 'Featured Houses' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading...')
  })
})

describe('lazy pages', () => {
  it('renders the named export once its module has loaded', async () => {
    const Page = lazyPage(async () => ({ Hello: ({ name }: { name: string }) => <p>Hello {name}</p> }), 'Hello')
    const router = createMemoryRouter([{ path: '/', element: <Page name="Ada" /> }])

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Hello Ada')).toBeInTheDocument()
  })
})
