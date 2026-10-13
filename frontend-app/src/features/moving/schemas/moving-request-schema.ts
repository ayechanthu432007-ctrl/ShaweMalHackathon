import type { InventoryCatalogItem } from '../constants/inventory-catalog'
import { hasMapPin } from '../lib/moving-location'
import type { MovingInventoryItem } from '../types'

export type MovingRequestFormValues = {
  pickupAddress: string
  dropoffAddress: string
  pickupStreet: string
  dropoffStreet: string
  pickupTownship: string
  dropoffTownship: string
  pickupLatitude: string
  pickupLongitude: string
  dropoffLatitude: string
  dropoffLongitude: string
  pickupFloorLevelId: string
  dropoffFloorLevelId: string
  moveInDate: string
  vehicleTypeId: string
  remarks: string
  damageChecklist: string
  photo1: string
  photo2: string
  photo3: string
  photo4: string
  photo5: string
  totalInventoryItems: string
  inventoryCounts: Record<string, number>
}

export function collectPhotoPaths(values: MovingRequestFormValues): string[] {
  return [values.photo1, values.photo2, values.photo3, values.photo4, values.photo5]
    .map((path) => path.trim())
    .filter(Boolean)
}

export function sumInventoryCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

export function buildInventoryItems(
  counts: Record<string, number>,
  catalog: InventoryCatalogItem[],
): Array<MovingInventoryItem & { inventoryItemTypeId: string }> {
  return catalog
    .map((item) => ({
      inventoryItemTypeId: item.id,
      category: item.category,
      itemName: item.itemName,
      count: Number(counts[item.id] ?? 0),
    }))
    .filter((item) => item.count > 0)
}

export function validateMovingStep1(
  values: Pick<
    MovingRequestFormValues,
    | 'pickupAddress'
    | 'dropoffAddress'
    | 'pickupTownship'
    | 'dropoffTownship'
    | 'pickupLatitude'
    | 'pickupLongitude'
    | 'dropoffLatitude'
    | 'dropoffLongitude'
  >,
  t: (key: string) => string,
  townshipNames: string[] = [],
) {
  const errors: Partial<
    Record<
      | 'pickupAddress'
      | 'dropoffAddress'
      | 'pickupTownship'
      | 'dropoffTownship'
      | 'pickupLatitude'
      | 'dropoffLatitude',
      string
    >
  > = {}

  if (!values.pickupTownship.trim()) errors.pickupTownship = t('auth.required')
  if (!values.dropoffTownship.trim()) errors.dropoffTownship = t('auth.required')

  if (
    townshipNames.length > 0 &&
    values.pickupTownship.trim() &&
    !townshipNames.includes(values.pickupTownship.trim())
  ) {
    errors.pickupTownship = t('moving.townshipInvalid')
  }
  if (
    townshipNames.length > 0 &&
    values.dropoffTownship.trim() &&
    !townshipNames.includes(values.dropoffTownship.trim())
  ) {
    errors.dropoffTownship = t('moving.townshipInvalid')
  }

  if (!values.pickupAddress.trim()) errors.pickupAddress = t('auth.required')
  if (!values.dropoffAddress.trim()) errors.dropoffAddress = t('auth.required')
  if (!hasMapPin(values.pickupLatitude, values.pickupLongitude)) {
    errors.pickupLatitude = t('moving.mapPinRequired')
  }
  if (!hasMapPin(values.dropoffLatitude, values.dropoffLongitude)) {
    errors.dropoffLatitude = t('moving.mapPinRequired')
  }
  return errors
}

export function validateMovingStep2(
  values: MovingRequestFormValues,
  t: (key: string) => string,
) {
  const errors: Partial<
    Record<'pickupFloorLevelId' | 'dropoffFloorLevelId' | 'photos' | 'totalInventoryItems', string>
  > = {}

  if (!values.pickupFloorLevelId.trim()) errors.pickupFloorLevelId = t('auth.required')
  if (!values.dropoffFloorLevelId.trim()) errors.dropoffFloorLevelId = t('auth.required')

  const photos = collectPhotoPaths(values)
  if (photos.length > 5) {
    errors.photos = t('moving.photosMax')
  }

  const total = Number(values.totalInventoryItems)
  if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(total)) {
    errors.totalInventoryItems = t('moving.totalInventoryRequired')
  }

  return errors
}

/** Today in the visitor's own time zone, in the YYYY-MM-DD form a date input uses. */
export function todayDateInputValue(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function validateMovingStep3(
  values: Pick<MovingRequestFormValues, 'moveInDate' | 'vehicleTypeId'>,
  t: (key: string) => string,
) {
  const errors: Partial<Record<'moveInDate' | 'vehicleTypeId', string>> = {}
  if (!values.moveInDate.trim()) errors.moveInDate = t('auth.required')
  else if (values.moveInDate < todayDateInputValue()) errors.moveInDate = t('moving.moveInDatePast')
  if (!values.vehicleTypeId.trim()) errors.vehicleTypeId = t('auth.required')
  return errors
}

export function validateMovingRequestForm(
  values: MovingRequestFormValues,
  t: (key: string) => string,
) {
  return {
    ...validateMovingStep1(values, t),
    ...validateMovingStep2(values, t),
    ...validateMovingStep3(values, t),
  }
}
