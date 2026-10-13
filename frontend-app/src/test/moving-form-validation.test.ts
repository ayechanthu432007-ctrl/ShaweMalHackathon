import { describe, expect, it } from 'vitest'

import {
  buildInventoryItems,
  collectPhotoPaths,
  validateMovingRequestForm,
  validateMovingStep1,
  validateMovingStep2,
  validateMovingStep3,
  type MovingRequestFormValues,
} from '@/features/moving/schemas/moving-request-schema'

const t = (key: string) => key

const catalog = [
  { id: 'inv-bed', code: 'bedroom_single_bed', category: 'bedroom', itemName: 'Single bed', points: 8 },
]

function baseValues(overrides: Partial<MovingRequestFormValues> = {}): MovingRequestFormValues {
  return {
    pickupAddress: 'Pickup St, Kamayut Township, Yangon, Myanmar',
    dropoffAddress: 'Dropoff St, Bahan Township, Yangon, Myanmar',
    pickupStreet: 'Pickup St',
    dropoffStreet: 'Dropoff St',
    pickupTownship: 'Kamayut Township',
    dropoffTownship: 'Bahan Township',
    pickupLatitude: '16.82',
    pickupLongitude: '96.13',
    dropoffLatitude: '16.81',
    dropoffLongitude: '96.17',
    pickupFloorLevelId: 'floor-1',
    dropoffFloorLevelId: 'floor-2',
    moveInDate: '2999-09-01',
    vehicleTypeId: 'vt1',
    remarks: '',
    damageChecklist: '',
    photo1: 'uploads/moving/p1.jpg',
    photo2: '',
    photo3: '',
    photo4: '',
    photo5: '',
    totalInventoryItems: '2',
    inventoryCounts: {
      'inv-bed': 2,
    },
    ...overrides,
  }
}

describe('moving request form validation', () => {
  it('accepts a complete form payload shape', () => {
    const values = baseValues()
    const errors = validateMovingRequestForm(values, t)

    expect(errors).toEqual({})
    expect(collectPhotoPaths(values)).toEqual(['uploads/moving/p1.jpg'])
    expect(buildInventoryItems(values.inventoryCounts, catalog)).toEqual([
      { inventoryItemTypeId: 'inv-bed', category: 'bedroom', itemName: 'Single bed', count: 2 },
    ])
  })

  it('blocks step 1 without townships and map pins', () => {
    const errors = validateMovingStep1(
      baseValues({
        pickupAddress: '',
        dropoffAddress: '',
        pickupTownship: '',
        dropoffTownship: '',
        pickupLatitude: '',
        pickupLongitude: '',
        dropoffLatitude: '',
        dropoffLongitude: '',
      }),
      t,
      ['Kamayut Township', 'Bahan Township'],
    )
    expect(errors.pickupTownship).toBe('auth.required')
    expect(errors.dropoffTownship).toBe('auth.required')
    expect(errors.pickupLatitude).toBe('moving.mapPinRequired')
    expect(errors.dropoffLatitude).toBe('moving.mapPinRequired')
  })

  it('rejects a township that is not in the Yangon list', () => {
    const errors = validateMovingStep1(
      baseValues({ pickupTownship: 'Mandalay' }),
      t,
      ['Kamayut Township', 'Bahan Township'],
    )
    expect(errors.pickupTownship).toBe('moving.townshipInvalid')
  })

  it('blocks step 2 when inventory total is zero', () => {
    const errors = validateMovingStep2(
      baseValues({
        totalInventoryItems: '0',
        inventoryCounts: { 'inv-bed': 0 },
        photo1: '',
        pickupFloorLevelId: '',
        dropoffFloorLevelId: '',
      }),
      t,
    )

    expect(errors.pickupFloorLevelId).toBe('auth.required')
    expect(errors.dropoffFloorLevelId).toBe('auth.required')
    expect(errors.photos).toBeUndefined()
    expect(errors.totalInventoryItems).toBe('moving.totalInventoryRequired')
  })

  it('blocks step 3 without a move-in date or vehicle type', () => {
    const errors = validateMovingStep3(baseValues({ moveInDate: '', vehicleTypeId: '' }), t)
    expect(errors.moveInDate).toBe('auth.required')
    expect(errors.vehicleTypeId).toBe('auth.required')
  })

  it('requires vehicle type only on the full confirm payload', () => {
    const errors = validateMovingRequestForm(baseValues({ vehicleTypeId: '' }), t)
    expect(errors.vehicleTypeId).toBe('auth.required')
  })
})
