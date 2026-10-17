/**
 * Marketplace demo: posting quota and paid boosts, run entirely in the browser.
 *
 * Everything here is sample data held in this browser's storage. Nothing is sent to the
 * Shawe MaL API, no payment endpoint is called, and no real listing, order or boost is
 * created. The demo has its own clock (real time plus an offset) so a presenter can jump a
 * day or a month ahead without touching any real timestamp.
 */

export const DEMO_POST_LIMIT = 5
export const DEMO_BOOST_PRICE_MMK = 5500
export const DEMO_BOOST_HOURS = 24
const HOUR_MS = 60 * 60 * 1000
const YANGON_OFFSET_MS = 6.5 * HOUR_MS
const STORAGE_KEY = 'shawemal.marketplaceDemo.v1'

export type DemoPost = { id: string; title: string; priceMmk: number; category: string; createdAt: number }
export type DemoBoost = { postId: string; activatedAt: number; expiresAt: number; reference: string }
export type DemoPayment = { reference: string; postId: string; amountMmk: number; outcome: 'SUCCESS' | 'FAILED'; at: number }

export type DemoState = {
  user: string
  posts: DemoPost[]
  /** Posts created per Yangon month, e.g. { '2026-10': 3 }. Deleting a post never lowers it. */
  createdByMonth: Record<string, number>
  boosts: DemoBoost[]
  payments: DemoPayment[]
  clockOffsetMs: number
  nextId: number
}

export const initialDemoState = (): DemoState => ({
  user: 'Demo Seller (sample account)',
  posts: [],
  createdByMonth: {},
  boosts: [],
  payments: [],
  clockOffsetMs: 0,
  nextId: 1,
})

export const demoNow = (state: DemoState, realNow = Date.now()) => realNow + state.clockOffsetMs

/** The Asia/Yangon calendar month a moment falls in, e.g. '2026-10'. */
export const yangonMonth = (time: number) => {
  const shifted = new Date(time + YANGON_OFFSET_MS)
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

export const nextYangonMonthStart = (time: number) => {
  const shifted = new Date(time + YANGON_OFFSET_MS)
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1) - YANGON_OFFSET_MS
}

export const quotaFor = (state: DemoState, now: number) => {
  const used = state.createdByMonth[yangonMonth(now)] ?? 0
  return { used, limit: DEMO_POST_LIMIT, remaining: Math.max(0, DEMO_POST_LIMIT - used), resetsAt: nextYangonMonthStart(now) }
}

export const activeBoost = (state: DemoState, postId: string, now: number) =>
  state.boosts.find((boost) => boost.postId === postId && boost.activatedAt <= now && now < boost.expiresAt) ?? null

/** Active boosts first (newest boost first), then the rest, newest post first. */
export const rankedPosts = (state: DemoState, now: number) =>
  [...state.posts].sort((a, b) => {
    const boostA = activeBoost(state, a.id, now)
    const boostB = activeBoost(state, b.id, now)
    if (boostA && boostB) return boostB.activatedAt - boostA.activatedAt
    if (boostA) return -1
    if (boostB) return 1
    return b.createdAt - a.createdAt
  })

export type DemoErrorCode = 'LIMIT_REACHED' | 'ALREADY_BOOSTED' | 'NOT_FOUND' | 'PAYMENT_FAILED' | 'INVALID'

export class DemoError extends Error {
  code: DemoErrorCode
  constructor(code: DemoErrorCode) {
    super(code)
    this.code = code
  }
}

export function createPost(state: DemoState, input: { title: string; priceMmk: number; category: string }, now: number): DemoState {
  const title = input.title.trim()
  if (!title || !Number.isFinite(input.priceMmk) || input.priceMmk < 0) throw new DemoError('INVALID')
  if (quotaFor(state, now).remaining <= 0) throw new DemoError('LIMIT_REACHED')
  const month = yangonMonth(now)
  const post: DemoPost = { id: `demo-post-${state.nextId}`, title, priceMmk: Math.round(input.priceMmk), category: input.category, createdAt: now }
  return {
    ...state,
    posts: [...state.posts, post],
    createdByMonth: { ...state.createdByMonth, [month]: (state.createdByMonth[month] ?? 0) + 1 },
    nextId: state.nextId + 1,
  }
}

/** Editing never uses a post from the monthly allowance. */
export function editPost(state: DemoState, postId: string, title: string): DemoState {
  if (!title.trim()) throw new DemoError('INVALID')
  if (!state.posts.some((post) => post.id === postId)) throw new DemoError('NOT_FOUND')
  return { ...state, posts: state.posts.map((post) => (post.id === postId ? { ...post, title: title.trim() } : post)) }
}

/** Deleting does not hand the monthly slot back. */
export function deletePost(state: DemoState, postId: string): DemoState {
  return { ...state, posts: state.posts.filter((post) => post.id !== postId), boosts: state.boosts.filter((boost) => boost.postId !== postId) }
}

/**
 * Simulated checkout for one post. The outcome is chosen by the presenter; a failed payment
 * is recorded and leaves the post unboosted. An active boost is never charged twice.
 */
export function boostPost(state: DemoState, postId: string, outcome: 'SUCCESS' | 'FAILED', now: number): DemoState {
  if (!state.posts.some((post) => post.id === postId)) throw new DemoError('NOT_FOUND')
  if (activeBoost(state, postId, now)) throw new DemoError('ALREADY_BOOSTED')
  const reference = `DEMO-BOOST-${state.nextId}`
  const payment: DemoPayment = { reference, postId, amountMmk: DEMO_BOOST_PRICE_MMK, outcome, at: now }
  const next = { ...state, payments: [...state.payments, payment], nextId: state.nextId + 1 }
  if (outcome === 'FAILED') return next
  return { ...next, boosts: [...next.boosts, { postId, activatedAt: now, expiresAt: now + DEMO_BOOST_HOURS * HOUR_MS, reference }] }
}

export const advanceClock = (state: DemoState, ms: number): DemoState => ({ ...state, clockOffsetMs: state.clockOffsetMs + ms })

/** Jump the demo clock to the first moment of next month (Yangon time). */
export const advanceToNextMonth = (state: DemoState, realNow = Date.now()): DemoState => {
  const now = demoNow(state, realNow)
  return { ...state, clockOffsetMs: state.clockOffsetMs + (nextYangonMonthStart(now) - now) + 60_000 }
}

export const SAMPLE_POSTS = [
  { title: 'Wooden study desk', priceMmk: 85000, category: 'Furniture' },
  { title: 'Single bed frame with mattress', priceMmk: 150000, category: 'Furniture' },
  { title: 'Rice cooker (1.8 L)', priceMmk: 35000, category: 'Kitchen' },
  { title: 'Standing fan', priceMmk: 42000, category: 'Appliances' },
  { title: 'Plastic storage boxes (set of 4)', priceMmk: 18000, category: 'Home essentials' },
  { title: 'Bookshelf, 5 tiers', priceMmk: 60000, category: 'Furniture' },
]

export function loadDemoState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...initialDemoState(), ...(JSON.parse(raw) as DemoState) } : initialDemoState()
  } catch {
    return initialDemoState()
  }
}

export function saveDemoState(state: DemoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be blocked; the demo then lasts until the page is left.
  }
}

/** Demo-only reset: clears this browser's sample data. It cannot reach any real record. */
export function resetDemoState(): DemoState {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored.
  }
  return initialDemoState()
}

/** The demo appears only in builds that set VITE_MARKETPLACE_DEMO=true (the development build). */
export const isMarketplaceDemoEnabled = () => import.meta.env.VITE_MARKETPLACE_DEMO === 'true'
