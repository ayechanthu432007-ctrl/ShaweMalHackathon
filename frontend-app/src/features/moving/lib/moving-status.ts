export const ACTIVE_MOVING_STATUSES = [
  'BOOKED',
  'ACCEPTED',
  'ASSIGNED',
  'DRIVER_COMING',
  'DRIVER_ARRIVED',
  'LOADING',
  'ON_THE_WAY',
  'UNLOADING',
] as const

export const PAST_MOVING_STATUSES = ['COMPLETED', 'CANCELLED'] as const

export const ALL_MOVING_STATUSES = [...ACTIVE_MOVING_STATUSES, ...PAST_MOVING_STATUSES] as const

export const MOVING_TIMELINE_STEPS = [
  { id: 'booking_confirmed', statuses: ['BOOKED'], etaStage: null },
  { id: 'driver_assigned', statuses: ['ACCEPTED', 'ASSIGNED'], etaStage: null },
  { id: 'driver_coming', statuses: ['DRIVER_COMING'], etaStage: 'driver_coming' },
  { id: 'driver_arrived', statuses: ['DRIVER_ARRIVED'], etaStage: 'driver_arrived' },
  { id: 'loading', statuses: ['LOADING'], etaStage: 'loading' },
  { id: 'on_the_way', statuses: ['ON_THE_WAY'], etaStage: 'on_the_way' },
  { id: 'unloading', statuses: ['UNLOADING'], etaStage: 'unloading' },
  { id: 'completed', statuses: ['COMPLETED'], etaStage: null },
] as const

export type MovingTimelineStepId = (typeof MOVING_TIMELINE_STEPS)[number]['id']

export function isActiveMovingStatus(status: string): boolean {
  return (ACTIVE_MOVING_STATUSES as readonly string[]).includes(status)
}

export function timelineIndexForStatus(status: string): number {
  if (status === 'CANCELLED') {
    return -1
  }

  return MOVING_TIMELINE_STEPS.findIndex((step) => (step.statuses as readonly string[]).includes(status))
}

export function timelineProgressIndex(
  status: string,
  statusEvents: Array<{ status?: string | null }> = [],
): number {
  if (status !== 'CANCELLED') {
    return timelineIndexForStatus(status)
  }

  const indexes = statusEvents
    .map((event) => (event.status ? timelineIndexForStatus(event.status) : -1))
    .filter((index) => index >= 0)

  return indexes.length > 0 ? Math.max(...indexes) : -1
}

export function timelineStepState(
  stepIndex: number,
  status: string,
  statusEvents: Array<{ status?: string | null }> = [],
): 'complete' | 'current' | 'pending' {
  if (status === 'COMPLETED') {
    return 'complete'
  }

  const progressIndex = timelineProgressIndex(status, statusEvents)

  if (status === 'CANCELLED') {
    return stepIndex <= progressIndex ? 'complete' : 'pending'
  }

  if (stepIndex < progressIndex) {
    return 'complete'
  }

  if (stepIndex === progressIndex) {
    return 'current'
  }

  return 'pending'
}

export function pickDefaultMovingRequestId<T extends { id: string; status: string; updatedAt?: string }>(
  items: T[],
  requestedId?: string,
): string | null {
  if (requestedId && items.some((item) => item.id === requestedId)) {
    return requestedId
  }

  const active = items.filter((item) => isActiveMovingStatus(item.status))
  const pool = active.length > 0 ? active : items
  if (pool.length === 0) {
    return null
  }

  return [...pool].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
    return bTime - aTime
  })[0].id
}

export function latestEtaForStage(
  etaEntries: Array<{ stage: string; etaAt: string; createdAt?: string }> | undefined,
  stage: string | null,
): string | null {
  if (!stage || !etaEntries?.length) {
    return null
  }

  const matches = etaEntries.filter((entry) => entry.stage === stage)
  if (matches.length === 0) {
    return null
  }

  return [...matches].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.etaAt).getTime()
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.etaAt).getTime()
    return bTime - aTime
  })[0].etaAt
}

export function remainingMinutes(etaAt: string, now = new Date()): number | null {
  const eta = new Date(etaAt)
  if (Number.isNaN(eta.getTime())) {
    return null
  }

  const diff = Math.round((eta.getTime() - now.getTime()) / 60000)
  return diff > 0 ? diff : null
}

export function eventTimestampForStatuses(
  statusEvents: Array<{ status?: string | null; createdAt: string }> | undefined,
  statuses: readonly string[],
): string | null {
  const match = [...(statusEvents ?? [])]
    .reverse()
    .find((event) => event.status && statuses.includes(event.status))

  return match?.createdAt ?? null
}

export function assignedDriverName(request: {
  assignedDriver?: {
    name?: string | null
    driverProfile?: { name?: string | null } | null
  } | null
}): string | null {
  return request.assignedDriver?.driverProfile?.name || request.assignedDriver?.name || null
}

export function assignedDriverPhone(request: {
  assignedDriver?: {
    phone?: string | null
    driverProfile?: { phone?: string | null } | null
  } | null
}): string | null {
  return request.assignedDriver?.driverProfile?.phone || request.assignedDriver?.phone || null
}

export function assignedDriverEmail(request: {
  assignedDriver?: {
    email?: string | null
  } | null
}): string | null {
  return request.assignedDriver?.email || null
}

export function assignedDriverProfilePhotoPath(request: {
  assignedDriver?: {
    driverProfile?: { profilePhotoPath?: string | null } | null
  } | null
}): string | null {
  return request.assignedDriver?.driverProfile?.profilePhotoPath || null
}

export function assignedLicensePlate(request: {
  assignedDriver?: {
    driverProfile?: { vehicleLicensePlateNumber?: string | null } | null
  } | null
}): string | null {
  return request.assignedDriver?.driverProfile?.vehicleLicensePlateNumber || null
}

export function vehicleLabel(request: {
  vehicleType?: { name?: string | null; capacityLabel?: string | null } | null
}): string {
  const name = request.vehicleType?.name
  const capacity = request.vehicleType?.capacityLabel
  if (name && capacity) {
    return `${name} (${capacity})`
  }

  return name || '—'
}

/** When a move was finished: the time of its COMPLETED status event, or its last update as a fallback. */
export function completionDate(request: {
  status: string
  statusEvents?: Array<{ status?: string | null; createdAt: string }>
  updatedAt?: string
}): string | null {
  if (request.status !== 'COMPLETED') return null
  return eventTimestampForStatuses(request.statusEvents, ['COMPLETED']) ?? request.updatedAt ?? null
}
