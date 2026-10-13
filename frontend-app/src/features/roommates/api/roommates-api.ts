import { apiRequest } from '@/lib/api/client'

import type { RoommateCreateInput, RoommateListFilters, RoommateListResult, RoommatePost } from '../types'

function toQuery(filters: RoommateListFilters): string {
  const search = new URLSearchParams()
  if (filters.gender) search.set('gender', filters.gender)
  if (filters.occupationId?.trim()) search.set('occupationId', filters.occupationId.trim())
  if (filters.city?.trim()) search.set('city', filters.city.trim())
  if (filters.state?.trim()) search.set('state', filters.state.trim())
  if (filters.cityId?.trim()) search.set('cityId', filters.cityId.trim())
  if (filters.stateId?.trim()) search.set('stateId', filters.stateId.trim())
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const roommatesApi = {
  list(filters: RoommateListFilters = {}) {
    // Sent with the session when there is one, so each post comes back with the viewer's match.
    return apiRequest<RoommateListResult>(`/roommates${toQuery(filters)}`)
  },
  create(input: RoommateCreateInput) {
    return apiRequest<{ item: RoommatePost }>('/roommates', {
      method: 'POST',
      body: input,
    })
  },
  update(id: string, input: RoommateCreateInput) {
    return apiRequest<{ item: RoommatePost }>(`/roommates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    })
  },
  remove(id: string) {
    return apiRequest<{ id: string }>(`/roommates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}
