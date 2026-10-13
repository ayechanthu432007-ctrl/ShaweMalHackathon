export type AdminRole = 'normal' | 'agent' | 'driver' | 'admin'

export type VerificationAction = 'pending' | 'approve' | 'reject'

export type VerificationStatusValue = 'PENDING' | 'VERIFIED' | 'REJECTED'

export type AdminSafeUser = {
  id: string
  name: string
  email: string
  phone: string
  roles: string[]
  agentVerificationStatus: string | null
  driverVerificationStatus: string | null
}

export type NamedRef = {
  id: string
  name: string
}

export type AdminAgentRegistration = {
  user: AdminSafeUser
  profile: {
    id: string
    name: string
    nrc: string
    nrcFrontPhotoPath: string
    nrcBackPhotoPath: string
    /** The agent's account profile picture, when they uploaded one. */
    profilePhotoPath?: string | null
    email: string
    phone: string
    telegram?: string | null
    viber?: string | null
    address1: string
    address2?: string | null
    cityId: string
    stateId: string
    serviceRegionId: string
    city?: NamedRef | null
    state?: NamedRef | null
    serviceRegion?: NamedRef | null
    hasRentingExperience: boolean
    verificationStatus: VerificationStatusValue
    rejectionReason?: string | null
    reviewedAt?: string | null
    submittedAt?: string
  }
}

export type AdminDriverRegistration = {
  user: AdminSafeUser
  profile: {
    id: string
    name: string
    companyName?: string | null
    nrc: string
    nrcFrontPhotoPath: string
    nrcBackPhotoPath: string
    drivingLicensePhotoPath: string
    profilePhotoPath: string
    phone: string
    currentAddress: string
    vehicleTypeId: string
    vehicleType?: NamedRef | null
    vehicleLicensePlateNumber: string
    vehiclePhotoPath: string
    wheelTaxPhotoPath: string
    verificationStatus: VerificationStatusValue
    rejectionReason?: string | null
    reviewedAt?: string | null
    submittedAt?: string
  }
}

export type AdminAgentQueueItem = {
  userId: string
  name: string
  email: string
  phone: string
  nrc: string
  city: NamedRef
  state: NamedRef
  serviceRegion: NamedRef
  hasRentingExperience: boolean
  submittedAt: string
  verificationStatus: VerificationStatusValue
}

export type AdminDriverQueueItem = {
  userId: string
  name: string
  email: string
  phone: string
  nrc: string
  companyName?: string | null
  vehicleType: NamedRef
  vehicleLicensePlateNumber: string
  submittedAt: string
  verificationStatus: VerificationStatusValue
}

export type PaginatedVerificationList<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type VerificationQueueFilters = {
  status?: VerificationStatusValue | 'all'
  q?: string
  page?: number
  pageSize?: number
}

export type VerificationCounts = {
  pending: number
  verified: number
  rejected: number
  total: number
}

export type AdminOverviewReport = {
  period: {
    from: string | null
    to: string | null
  }
  userRegistrationsByRole: Array<{ role: string; count: number }>
  verification: {
    agents: VerificationCounts
    drivers: VerificationCounts
  }
  housing: {
    byCity: Array<{ cityId: string; city: string; count: number }>
    byType: Array<{ propertyTypeId: string; propertyType: string; count: number }>
    byAvailability: {
      available: number
      notAvailable: number
    }
  }
  bookingStatusSummary: Array<{ status: string; count: number }>
  movingRequestSummary: {
    byStatus: Array<{ status: string; count: number }>
    completed: number
    total: number
  }
  topPerformers: {
    agents: Array<{ userId: string; name: string; averageRating: number; ratingCount: number }>
    drivers: Array<{ userId: string; name: string; averageRating: number; ratingCount: number }>
  }
}

export type HouseBookingReportFilters = {
  from?: string
  to?: string
  status?: string
  houseId?: string
  agentId?: string
  userId?: string
}

export type MovingRequestReportFilters = {
  from?: string
  to?: string
  status?: string
}

export type AssignableDriver = {
  userId: string
  name: string
  email: string
  phone: string
  vehicleTypeName?: string | null
  vehicleLicensePlateNumber?: string | null
}

export type AdminMasterDataEntity =
  | 'property-types'
  | 'states'
  | 'cities'
  | 'contract-types'
  | 'vehicle-types'
  | 'service-regions'
  | 'floor-levels'
  | 'occupations'
  | 'amenities'
  | 'status-codes'
  | 'roles'
  | 'moving-inventory-items'

export type AdminMasterDataItem = {
  id: string
  isActive?: boolean
  name?: string
  description?: string | null
  countryCode?: string
  stateId?: string
  postalCodePrefix?: string | null
  durationMonths?: number
  capacityLabel?: string | null
  maxLoadKg?: number | null
  code?: string
  levelNumber?: number | null
  category?: string | null
  entityType?: string
  label?: string
  color?: string | null
  state?: { id: string; name: string } | null
  [key: string]: unknown
}

export type CreateUserInput = {
  name: string
  email: string
  phone: string
  password: string
  role: AdminRole
}

export type UpdateRolesInput = {
  roles: AdminRole[]
}
