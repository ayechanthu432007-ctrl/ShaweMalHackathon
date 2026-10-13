import { apiRequest } from '@/lib/api/client'

import type { HouseBookingResult, HouseDetails, HouseListItem, HouseListResult, HouseSearchParams } from '../types'

function toQuery(params: HouseSearchParams): string {
  const search = new URLSearchParams()
  if (params.city?.trim()) search.set('city', params.city.trim())
  if (params.type?.trim()) search.set('type', params.type.trim())
  if (typeof params.minBudget === 'number' && Number.isFinite(params.minBudget)) {
    search.set('minBudget', String(params.minBudget))
  }
  if (typeof params.maxBudget === 'number' && Number.isFinite(params.maxBudget)) {
    search.set('maxBudget', String(params.maxBudget))
  }
  if (typeof params.page === 'number') search.set('page', String(params.page))
  if (typeof params.pageSize === 'number') search.set('pageSize', String(params.pageSize))
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const housesApi = {
  list(params: HouseSearchParams = {}) {
    return apiRequest<HouseListResult>(`/houses${toQuery(params)}`, { auth: false })
  },
  getById(id: string) {
    return apiRequest<{ item: HouseDetails }>(`/houses/${id}`, { auth: false })
  },
  related(id: string) {
    return apiRequest<{ items: HouseListItem[] }>(`/houses/${id}/related`, { auth: false })
  },
  book(id: string) {
    return apiRequest<HouseBookingResult>(`/houses/${id}/bookings`, {
      method: 'POST',
      body: {},
    })
  },
}
