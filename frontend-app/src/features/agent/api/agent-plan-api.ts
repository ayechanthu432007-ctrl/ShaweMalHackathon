import { apiRequest } from '@/lib/api/client'

export type PlanCode = 'FREE' | 'SILVER' | 'GOLD'

export type Plan = {
  code: PlanCode
  name: string
  rank: number
  monthlyPriceMmk: number
  quarterlyPriceMmk: number
  monthlyListingLimit: number | null
  freeBoostDays: number
  badgeEligible: boolean
  performanceLevel: 'BASIC' | 'OVERVIEW' | 'DETAILED'
  audienceInsights: boolean
  monthlyReport: boolean
}

export type Totals = {
  views: number
  calls: number
  telegram: number
  viber: number
  bookings: number
  inquiries: number
}

export type AgentDashboard = {
  plan: Plan
  subscription: {
    status: 'ACTIVE' | 'EXPIRED' | 'FREE'
    billingMonths: number | null
    startsAt: string | null
    endsAt: string | null
    daysRemaining: number | null
  }
  plans: Plan[]
  listingUsage: { month: string; used: number; limit: number | null; remaining: number | null; resetsAt: string }
  listingCount: number
  freeBoost: { granted: number; used: number; remaining: number; expiresAt: string | null }
  activeBoosts: number
  boostPricePerDay: number
  verification: {
    status: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
    rejectionReason: string | null
    reviewedAt: string | null
    badgeEligiblePlan: boolean
    badgeShown: boolean
  }
  features: { performanceOverview: boolean; performanceDetailed: boolean; audienceInsights: boolean; monthlyReport: boolean }
  last30Days: Totals
  demoPayments: boolean
}

export type ListingStats = Totals & { house: { id: string; title: string; availability: string } }

export type Performance = {
  level: Plan['performanceLevel']
  rangeDays: number
  totals: Totals
  series: Array<Totals & { day: string }> | null
  listings: ListingStats[] | null
}

export type Insights = {
  rangeDays: number
  totalViews: number
  viewsByHour: number[]
  viewsByWeekday: number[]
  signedInViews: number
  guestViews: number
  contactMethods: { calls: number; telegram: number; viber: number; bookings: number }
  viewToInquiryRate: number | null
  topListings: ListingStats[]
}

export type MonthlyReport = {
  month: string
  isPartial: boolean
  totals: Totals
  previousMonth: string
  previousTotals: Totals
  newListings: number
  listings: ListingStats[]
}

export type PaymentOrder = {
  reference: string
  kind: 'SUBSCRIPTION' | 'BOOST'
  plan: { code: PlanCode; name: string } | null
  billingMonths: number | null
  houseId: string | null
  boostDays: number | null
  amountMmk: number
  currency: string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
  isDemo: boolean
  provider: string
  expiresAt: string
  paidAt: string | null
  createdAt: string
}

export type Boost = {
  id: string
  house: { id: string; title: string; availability: string }
  source: 'FREE_ENTITLEMENT' | 'PURCHASED'
  days: number
  startsAt: string
  endsAt: string
  status: 'ACTIVE' | 'SCHEDULED' | 'ENDED' | 'CANCELLED' | 'PAUSED'
  hoursRemaining: number
}

export type HouseEventType = 'VIEW' | 'CALL' | 'TELEGRAM' | 'VIBER'

export const agentPlanApi = {
  dashboard() {
    return apiRequest<{ dashboard: AgentDashboard }>('/agent/dashboard')
  },
  performance(days: number) {
    return apiRequest<{ performance: Performance }>(`/agent/performance?days=${days}`)
  },
  insights() {
    return apiRequest<{ insights: Insights }>('/agent/insights')
  },
  monthlyReport(month?: string) {
    return apiRequest<{ report: MonthlyReport }>(`/agent/reports/monthly${month ? `?month=${month}` : ''}`)
  },
  boosts() {
    return apiRequest<{ items: Boost[] }>('/agent/boosts')
  },
  applyFreeBoost(houseId: string, days: number) {
    return apiRequest<{ boost: { id: string } }>('/agent/boosts/free', { method: 'POST', body: { houseId, days } })
  },
  createBoostOrder(houseId: string, days: number) {
    return apiRequest<{ order: PaymentOrder }>('/agent/boosts/orders', { method: 'POST', body: { houseId, days } })
  },
  // Only the plan and period are sent. The server decides the price.
  createSubscriptionOrder(planCode: PlanCode, billingMonths: 1 | 3) {
    return apiRequest<{ order: PaymentOrder }>('/agent/subscription/orders', { method: 'POST', body: { planCode, billingMonths } })
  },
  orders() {
    return apiRequest<{ items: PaymentOrder[] }>('/agent/payments/orders')
  },
  order(reference: string) {
    return apiRequest<{ order: PaymentOrder }>(`/agent/payments/orders/${encodeURIComponent(reference)}`)
  },
  simulateDemoPayment(reference: string, outcome: 'success' | 'pending' | 'failed') {
    return apiRequest<{ result: string; status: string; order: PaymentOrder }>(
      `/agent/payments/orders/${encodeURIComponent(reference)}/demo`,
      { method: 'POST', body: { outcome } },
    )
  },
}

/** Fire-and-forget: analytics must never break or slow the page. */
export function trackHouseEvent(houseId: string, type: HouseEventType) {
  void apiRequest(`/houses/${encodeURIComponent(houseId)}/events`, { method: 'POST', body: { type } }).catch(() => undefined)
}

export function formatMmk(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} MMK`
}

export function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}
