import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PublicLayout } from '@/features/public/layout/PublicLayout'
import { HomePage } from '@/features/public/pages/HomePage'
import { i18n } from '@/lib/i18n'
import { renderWithProviders } from '@/test/utils'

describe('language toggle', () => {
  it('updates visible strings when switching language', async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage('en')

    renderWithProviders(
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<HomePage />} />
        </Route>
      </Routes>,
    )

    expect(await screen.findByText('Shawe MaL')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /language/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^myanmar$/i }))

    expect(await screen.findByText('ရွှေ့မယ်')).toBeInTheDocument()
    await i18n.changeLanguage('en')
  })
})
