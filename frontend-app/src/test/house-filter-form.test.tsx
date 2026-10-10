import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { HouseFilterForm } from '@/features/houses/components/HouseFilterForm'
import { renderWithProviders } from '@/test/utils'

describe('house filter form', () => {
  it('submits selected city, type, and budget filters', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    renderWithProviders(
      <HouseFilterForm
        defaultValues={{ city: '', type: '', minBudget: '', maxBudget: '' }}
        cities={[{ id: 'c1', name: 'Yangon' }]}
        propertyTypes={[{ id: 'pt1', name: 'Condo' }]}
        onSubmit={onSubmit}
      />,
    )

    await user.selectOptions(screen.getByLabelText(/^city$/i), 'Yangon')
    await user.selectOptions(screen.getByLabelText(/property type/i), 'Condo')
    await user.type(screen.getByLabelText(/minimum budget/i), '100000')
    await user.type(screen.getByLabelText(/maximum budget/i), '500000')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      city: 'Yangon',
      type: 'Condo',
      minBudget: '100000',
      maxBudget: '500000',
    })
  })
})
