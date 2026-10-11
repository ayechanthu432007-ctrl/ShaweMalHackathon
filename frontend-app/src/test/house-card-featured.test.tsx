import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HouseCard } from '@/features/houses/components/HouseCard'
import { renderWithProviders } from '@/test/utils'

const house = { id: 'h1', title: 'Golden Condo', monthlyFees: 450000, availability: 'available' as const }

describe('house card paid placement', () => {
  it('discloses a boosted listing as Featured', () => {
    renderWithProviders(<HouseCard house={{ ...house, isBoosted: true }} />)

    expect(screen.getByText('Featured')).toBeInTheDocument()
    expect(screen.queryByText('Boosted')).not.toBeInTheDocument()
  })

  it('shows no label on an ordinary listing', () => {
    renderWithProviders(<HouseCard house={{ ...house, isBoosted: false }} />)

    expect(screen.queryByText('Featured')).not.toBeInTheDocument()
  })
})
