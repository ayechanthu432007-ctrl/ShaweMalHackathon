import { apiRequest } from '@/lib/api/client'

import type { ReviewCreateInput, ReviewItem } from '../types'

export const reviewsApi = {
  create(input: ReviewCreateInput) {
    return apiRequest<{ item: ReviewItem }>('/reviews', {
      method: 'POST',
      body: input,
    })
  },
  list(targetType: 'AGENT' | 'DRIVER', targetUserId: string) {
    const search = new URLSearchParams({ targetType, targetUserId })
    return apiRequest<{ items: ReviewItem[]; summary?: { averageRating: number; reviewCount: number } }>(
      `/reviews?${search.toString()}`,
      {
        auth: false,
      },
    )
  },
  summary(targetType: 'AGENT' | 'DRIVER', targetUserId?: string) {
    const search = new URLSearchParams({ targetType })
    if (targetUserId) search.set('targetUserId', targetUserId)
    return apiRequest<{ summary: { averageRating: number; reviewCount: number } }>(
      `/reviews/summary?${search.toString()}`,
      { auth: false },
    )
  },
}
