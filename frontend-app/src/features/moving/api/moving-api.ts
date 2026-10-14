import { apiRequest } from '@/lib/api/client'

import type { MovingQuote, MovingQuoteInput, MovingRequest, MovingRequestInput } from '../types'

export const movingApi = {
  quote(input: MovingQuoteInput) {
    return apiRequest<{ quote: MovingQuote }>('/moving/quote', {
      method: 'POST',
      body: input,
    })
  },
  create(input: MovingRequestInput) {
    return apiRequest<{ movingRequest: MovingRequest }>('/moving/requests', {
      method: 'POST',
      body: input,
    })
  },
  getById(id: string) {
    return apiRequest<{ movingRequest: MovingRequest }>(`/moving/requests/${id}`)
  },
  cancel(id: string) {
    return apiRequest<{ movingRequest: MovingRequest }>(`/moving/requests/${id}/cancel`, { method: 'POST' })
  },
  listMine() {
    return apiRequest<{ items: MovingRequest[] }>('/moving/requests')
  },
}
