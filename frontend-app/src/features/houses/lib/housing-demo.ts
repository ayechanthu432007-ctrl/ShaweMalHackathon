/**
 * Presentation demo: Housing search filters pre-selected for named demo accounts only. Applied
 * once, when the page is opened with no filters in its address; the person can change or clear
 * them normally, and nothing is saved to their preferences.
 *
 * Accounts are matched by display name or e-mail (case-insensitive). Override the list with
 * VITE_HOUSING_DEMO_ACCOUNTS (comma-separated); an empty string turns it off.
 */
export const HOUSING_DEMO_ACCOUNTS: string[] = (import.meta.env.VITE_HOUSING_DEMO_ACCOUNTS ?? 'Mg Mg')
  .split(',')
  .map((value: string) => value.trim().toLowerCase())
  .filter(Boolean)

/** Values are the option names the filter form uses (city and property type names). */
export const HOUSING_DEMO_FILTERS = { city: 'Hlaing', type: 'Condominium (Condo)' }

export function isHousingDemoAccount(user: { name?: string | null; email?: string | null } | null | undefined): boolean {
  if (!user) return false
  return [user.name, user.email].some((value) => HOUSING_DEMO_ACCOUNTS.includes((value ?? '').trim().toLowerCase()))
}
