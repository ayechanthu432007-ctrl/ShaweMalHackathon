/**
 * Intent-based prefetch for the header's section links: a section's page code starts downloading
 * when the visitor points at, focuses or touches its link, so the click rarely waits for a download.
 * Nothing is fetched up front, so first loads are not slowed (an idle-time prefetch of every section
 * measured ~1.7 s slower LCP under Lighthouse's slow-4G throttling).
 */
const sectionPages: Record<string, () => Promise<unknown>> = {
  '/finding-house': () => import('@/features/houses/pages/FindingHousePage'),
  '/hire-moving': () => import('@/features/moving/pages/HireMovingPage'),
  '/moving-status': () => import('@/features/moving/pages/MovingStatusListPage'),
  '/finding-roommates': () => import('@/features/roommates/pages/FindingRoommatesPage'),
  '/marketplace': () => import('@/features/marketplace/pages/MarketplaceHomePage'),
  '/sign-in': () => import('@/features/auth/pages/SignInPage'),
  '/sign-up': () => import('@/features/auth/pages/SignUpPage'),
  '/about-us': () => import('@/features/public/pages/AboutUsPage'),
}

const started = new Set<string>()

export function prefetchSection(path: string) {
  const load = sectionPages[path]
  if (!load || started.has(path)) return
  started.add(path)
  void load().catch(() => started.delete(path))
}

/** Props for a header link that prefetch its page on hover, keyboard focus or touch. */
export function prefetchProps(path: string) {
  const prefetch = () => prefetchSection(path)
  return { onPointerEnter: prefetch, onFocus: prefetch, onTouchStart: prefetch }
}
