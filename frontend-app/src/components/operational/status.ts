import type { BadgeTone } from '@/components/ui/badge'

/**
 * One colour language for every operational status in the product:
 * green = done, amber = waiting on someone, red = stopped or rejected,
 * blue = in progress, neutral = inactive or unknown, gold = paid placement.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  // Accounts, verification, master data
  ACTIVE: 'success',
  ENABLED: 'success',
  VERIFIED: 'success',
  APPROVED: 'success',
  INACTIVE: 'neutral',
  DISABLED: 'neutral',
  UNVERIFIED: 'warning',
  PENDING: 'warning',
  SUBMITTED: 'info',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
  BANNED: 'danger',
  BLOCKED: 'danger',

  // Bookings
  CONFIRMED: 'success',
  COMPLETED: 'success',
  BOOKED: 'warning',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',

  // Moving / driver journey
  ASSIGNED: 'info',
  ACCEPTED: 'info',
  DRIVER_COMING: 'info',
  DRIVER_ARRIVED: 'info',
  LOADING: 'info',
  ON_THE_WAY: 'info',
  UNLOADING: 'info',
  IN_PROGRESS: 'info',
  FAILED: 'danger',

  // Payments and plans
  PAID: 'success',
  UNPAID: 'warning',
  REFUNDED: 'info',
  EXPIRED: 'danger',
  PREMIUM: 'premium',
  BOOSTED: 'premium',
  FREE: 'neutral',

  // Marketplace and moderation
  OPEN: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
  PUBLISHED: 'success',
  DRAFT: 'neutral',
  REMOVED: 'danger',
  HIDDEN: 'neutral',
  SOLD: 'info',
  AVAILABLE: 'success',
  NOT_AVAILABLE: 'neutral',
  RESERVED: 'warning',
}

export function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim().replace(/[\s-]+/g, '_').toUpperCase()
}

export function statusTone(status: string | null | undefined): BadgeTone {
  return STATUS_TONES[normalizeStatus(status)] ?? 'neutral'
}

export function humanizeStatus(status: string | null | undefined): string {
  const normalized = normalizeStatus(status)
  if (!normalized) return '—'
  return normalized
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
