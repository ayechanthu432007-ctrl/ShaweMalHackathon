export type ProfileUser = {
  id: string
  name: string
  email: string
  phone: string
  profilePicturePath?: string | null
  agentVerificationStatus?: string | null
  driverVerificationStatus?: string | null
  roles: string[]
}

export type ProfileUpdateInput = {
  name?: string
  phone?: string
  profilePicturePath?: string | null
}

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

export type ProfileHistory = {
  bookingHistory: Array<{
    id: string
    status: string
    createdAt: string
    house?: {
      id: string
      title: string
      city?: { id: string; name: string } | null
      state?: { id: string; name: string } | null
      agentId?: string
      agent?: { id: string; name: string } | null
    } | null
    myReview?: { id: string; rating: number; comment?: string | null } | null
  }>
  movingHistory: Array<{
    id: string
    orderNumber?: string
    status: string
    pickupAddress: string
    dropoffAddress: string
    createdAt: string
    vehicleType?: { id: string; name: string } | null
    assignedDriver?: { id: string; name: string; phone?: string | null } | null
    myReview?: { id: string; rating: number; comment?: string | null } | null
  }>
  marketplaceHistory: Array<{
    id: string
    listingId: string
    title: string
    action: 'SAVED' | 'INQUIRY' | 'LISTED'
    status?: string
    createdAt: string
  }>
  notifications: {
    total: number
    unread: number
    recent: Array<{
      id: string
      title: string
      message: string
      isRead: boolean
      createdAt: string
    }>
  }
}
