import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  activeBoost,
  advanceClock,
  boostPost,
  createPost,
  DemoError,
  deletePost,
  editPost,
  initialDemoState,
  quotaFor,
  rankedPosts,
} from '@/features/marketplace/demo/marketplace-demo'
import { MarketplaceDemoPage } from '@/features/marketplace/demo/MarketplaceDemoPage'
import { renderWithProviders } from '@/test/utils'

const NOW = Date.parse('2026-10-16T05:00:00.000Z')
const HOUR = 60 * 60 * 1000
const item = (title: string) => ({ title, priceMmk: 10000, category: 'Sample' })

describe('marketplace demo rules', () => {
  it('allows five posts a month, blocks the sixth, and ignores edits and deletes', () => {
    let state = initialDemoState()
    for (let i = 1; i <= 5; i += 1) state = createPost(state, item(`Post ${i}`), NOW + i)
    expect(quotaFor(state, NOW)).toMatchObject({ used: 5, remaining: 0 })
    expect(() => createPost(state, item('Post 6'), NOW)).toThrow(DemoError)

    state = editPost(state, 'demo-post-1', 'Renamed')
    state = deletePost(state, 'demo-post-2')
    expect(quotaFor(state, NOW)).toMatchObject({ used: 5, remaining: 0 })

    // A new Yangon month starts fresh.
    expect(quotaFor(state, Date.parse('2026-11-01T00:00:00.000Z')).remaining).toBe(5)
  })

  it('boosts one post for 24 hours at 5,000 MMK, ranks it first, refuses a second charge and lets it expire', () => {
    let state = initialDemoState()
    state = createPost(state, item('Old desk'), NOW)
    state = createPost(state, item('New fan'), NOW + 1000)
    state = boostPost(state, 'demo-post-1', 'SUCCESS', NOW + 2000)

    const boost = activeBoost(state, 'demo-post-1', NOW + 2000)
    expect(boost?.expiresAt).toBe(NOW + 2000 + 24 * HOUR)
    expect(state.payments.at(-1)).toMatchObject({ amountMmk: 5000, outcome: 'SUCCESS' })
    expect(rankedPosts(state, NOW + 3000).map((post) => post.title)).toEqual(['Old desk', 'New fan'])
    expect(() => boostPost(state, 'demo-post-1', 'SUCCESS', NOW + 3000)).toThrow(DemoError)
    expect(state.payments).toHaveLength(1)

    const later = advanceClock(state, 24 * HOUR)
    const afterExpiry = NOW + 2000 + 24 * HOUR + later.clockOffsetMs - state.clockOffsetMs
    expect(activeBoost(later, 'demo-post-1', afterExpiry)).toBeNull()
    expect(rankedPosts(later, afterExpiry).map((post) => post.title)).toEqual(['New fan', 'Old desk'])
  })

  it('records a failed payment without boosting', () => {
    let state = createPost(initialDemoState(), item('Rice cooker'), NOW)
    state = boostPost(state, 'demo-post-1', 'FAILED', NOW)
    expect(activeBoost(state, 'demo-post-1', NOW)).toBeNull()
    expect(state.payments.at(-1)).toMatchObject({ outcome: 'FAILED' })
    expect(quotaFor(state, NOW).used).toBe(1)
  })
})

describe('marketplace demo page', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    localStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  const renderDemo = () =>
    renderWithProviders(
      <Routes>
        <Route path="/marketplace/demo" element={<MarketplaceDemoPage />} />
        <Route path="/marketplace" element={<p>marketplace home</p>} />
      </Routes>,
      { initialEntries: ['/marketplace/demo'] },
    )

  it('runs the whole journey in the browser without calling the API', async () => {
    vi.stubEnv('VITE_MARKETPLACE_DEMO', 'true')
    const user = userEvent.setup()
    renderDemo()

    expect(screen.getByText('DEMO MODE — SIMULATED', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('0/5 posts used')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create Sample Posts' }))
    expect(screen.getByText('3/5 posts used')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Item title'), 'Wardrobe')
    await user.type(screen.getByLabelText('Price (MMK)'), '120000')
    await user.click(screen.getByRole('button', { name: 'Create demo post' }))
    await user.click(screen.getByRole('button', { name: 'Create Sample Posts' }))
    expect(screen.getByText('5/5 posts used')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create Sample Posts' }))
    expect(screen.getByRole('alert')).toHaveTextContent('used all 5 posts')

    // Boost the post currently shown last and see it move to the top.
    const lastPost = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-demo-post')).at(-1) as HTMLElement
    const title = lastPost.querySelector('p')?.textContent ?? ''
    await user.click(within(lastPost).getByRole('button', { name: 'Boost Post' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(title)
    expect(dialog).toHaveTextContent('5,000 MMK')
    expect(dialog).toHaveTextContent('24 hours')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(within(lastPost).getByRole('button', { name: 'Boost Post' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Demo Payment' }))
    expect(await screen.findByText(/no real payment was taken/, {}, { timeout: 2000 })).toBeInTheDocument()
    const first = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-demo-post'))[0] as HTMLElement
    expect(first).toHaveTextContent(title)
    expect(first).toHaveTextContent('BOOSTED — DEMO')
    expect(within(first).getByRole('button', { name: 'Boost active' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Simulate 24 Hours Later' }))
    expect(screen.queryByText('BOOSTED — DEMO')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset Demo Data' }))
    expect(screen.getByText('0/5 posts used')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a failed payment and leaves the post unboosted', async () => {
    vi.stubEnv('VITE_MARKETPLACE_DEMO', 'true')
    const user = userEvent.setup()
    renderDemo()

    await user.click(screen.getByRole('button', { name: 'Create Sample Posts' }))
    await user.click(screen.getByRole('button', { name: 'Simulate Failed Payment' }))
    expect(screen.getByRole('alert')).toHaveTextContent('was not boosted')
    expect(screen.queryByText('BOOSTED — DEMO')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is not available when the build does not enable it', () => {
    vi.stubEnv('VITE_MARKETPLACE_DEMO', 'false')
    renderDemo()
    expect(screen.getByText('marketplace home')).toBeInTheDocument()
  })
})
