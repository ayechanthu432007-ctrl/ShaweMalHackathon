/**
 * Presentation demo: details pre-filled in the Hire Moving form for named demo accounts only, so a
 * demo can click Continue through the steps. Nothing is saved or submitted by this; the person can
 * still edit every field, and the booking is only created when they press Confirm booking.
 *
 * Accounts are matched by display name or e-mail (case-insensitive). Override the list with
 * VITE_MOVING_DEMO_ACCOUNTS (comma-separated); set it to an empty string to turn the pre-fill off.
 */
export const MOVING_DEMO_ACCOUNTS: string[] = (import.meta.env.VITE_MOVING_DEMO_ACCOUNTS ?? 'Mg Mg')
  .split(',')
  .map((value: string) => value.trim().toLowerCase())
  .filter(Boolean)

export const MOVING_DEMO_PRESET = {
  pickupTownship: 'Bahan',
  dropoffTownship: 'Insein',
  pickupFloor: '1st Floor',
  dropoffFloor: '2nd Floor',
  /** Inventory item codes from the moving-inventory-items master data, with quantities. */
  inventory: {
    bedroom_single_bed: 2,
    bedroom_couple_bed: 1,
    living_sofa_2: 2,
    living_air_conditioner: 1,
    kitchen_refrigerator: 1,
  } as Record<string, number>,
  moveInDate: '2026-10-20',
}

export function isMovingDemoAccount(user: { name?: string | null; email?: string | null } | null | undefined): boolean {
  if (!user) return false
  const keys = [user.name, user.email].map((value) => (value ?? '').trim().toLowerCase()).filter(Boolean)
  return keys.some((key) => MOVING_DEMO_ACCOUNTS.includes(key))
}
