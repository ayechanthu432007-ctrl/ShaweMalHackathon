import { describe, expect, it } from 'vitest'

import { isMovingDemoAccount, MOVING_DEMO_PRESET } from '@/features/moving/lib/moving-demo'

describe('moving demo pre-fill', () => {
  it('applies only to the named demo account', () => {
    expect(isMovingDemoAccount({ name: 'Mg Mg', email: 'mgmg@example.com' })).toBe(true)
    expect(isMovingDemoAccount({ name: '  mg mg ', email: null })).toBe(true)
    expect(isMovingDemoAccount({ name: 'Aung Aung', email: 'aung@example.com' })).toBe(false)
    expect(isMovingDemoAccount(null)).toBe(false)
  })

  it('holds the requested demo details, using the existing item codes and date format', () => {
    expect(MOVING_DEMO_PRESET).toMatchObject({
      pickupTownship: 'Bahan',
      dropoffTownship: 'Insein',
      pickupFloor: '1st Floor',
      dropoffFloor: '2nd Floor',
      moveInDate: '2026-10-20',
    })
    expect(MOVING_DEMO_PRESET.inventory).toEqual({
      bedroom_single_bed: 2,
      bedroom_couple_bed: 1,
      living_sofa_2: 2,
      living_air_conditioner: 1,
      kitchen_refrigerator: 1,
    })
  })
})
