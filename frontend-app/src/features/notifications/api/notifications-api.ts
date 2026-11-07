import { apiRequest } from '@/lib/api/client'

import type { AppNotification, NotificationsPayload } from '../types'

export type NotificationPreferences = {
  bookingUpdates: boolean
  listingUpdates: boolean
}

export const notificationsApi = {
  list() {
    return apiRequest<NotificationsPayload>('/notifications')
  },
  markRead(id: string) {
    return apiRequest<{ item: AppNotification }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    })
  },
  getPreferences() {
    return apiRequest<{ preferences: NotificationPreferences }>('/notifications/preferences')
  },
  updatePreferences(preferences: NotificationPreferences) {
    return apiRequest<{ preferences: NotificationPreferences }>('/notifications/preferences', {
      method: 'PUT',
      body: preferences,
    })
  },
}
