import { describe, expect, it } from 'vitest'

import { HOUSING_DEMO_FILTERS, isHousingDemoAccount } from '@/features/houses/lib/housing-demo'

describe('housing demo filters', () => {
  it('applies only to the named demo account', () => {
    expect(isHousingDemoAccount({ name: 'Mg Mg' })).toBe(true)
    expect(isHousingDemoAccount({ name: 'Su Su', email: 'su@example.com' })).toBe(false)
    expect(isHousingDemoAccount(null)).toBe(false)
  })

  it('selects Hlaing and Condominium (Condo) by their option names, with no budgets', () => {
    expect(HOUSING_DEMO_FILTERS).toEqual({ city: 'Hlaing', type: 'Condominium (Condo)' })
  })
})
