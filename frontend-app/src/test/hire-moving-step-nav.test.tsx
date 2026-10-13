import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { HireMovingStepNav } from '@/features/moving/components/HireMovingStepNav'
import { renderWithProviders } from '@/test/utils'

describe('moving form navigation row', () => {
  it('puts Back on the left and the forward button on the right, after the step content', async () => {
    const onBack = vi.fn()
    renderWithProviders(
      <form>
        <input aria-label="A field of the step" />
        <HireMovingStepNav onBack={onBack}>
          <Button type="submit">Continue</Button>
        </HireMovingStepNav>
      </form>,
    )

    const back = screen.getByRole('button', { name: 'Back' })
    const forward = screen.getByRole('button', { name: 'Continue' })
    const row = back.parentElement as HTMLElement
    expect([...row.children]).toEqual([back, forward])
    expect(row.className).toContain('justify-between')
    // The row comes after the fields of the step, not before them.
    expect(screen.getByLabelText('A field of the step').compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Back never submits the form.
    expect(back).toHaveAttribute('type', 'button')

    await userEvent.setup().click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('keeps the forward button on the right on the first step, where there is no Back', () => {
    renderWithProviders(
      <HireMovingStepNav>
        <Button type="submit">Continue</Button>
      </HireMovingStepNav>,
    )

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    const forward = screen.getByRole('button', { name: 'Continue' })
    expect((forward.parentElement as HTMLElement).lastElementChild).toBe(forward)
  })

  it('carries the final confirm button unchanged on the last form step', () => {
    renderWithProviders(
      <HireMovingStepNav onBack={() => {}}>
        <Button type="submit" disabled>
          Confirm booking
        </Button>
      </HireMovingStepNav>,
    )

    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
  })
})
