import { CalendarClock, CheckCircle2, Clock, FlaskConical, Pencil, Plus, RotateCcw, Rocket, Sparkles, Trash2, XCircle } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { PostQuotaMeter } from '../components/PostQuotaMeter'
import {
  activeBoost,
  advanceClock,
  advanceToNextMonth,
  boostPost,
  createPost,
  DEMO_BOOST_HOURS,
  DEMO_BOOST_PRICE_MMK,
  DemoError,
  deletePost,
  demoNow,
  editPost,
  isMarketplaceDemoEnabled,
  loadDemoState,
  quotaFor,
  rankedPosts,
  resetDemoState,
  saveDemoState,
  SAMPLE_POSTS,
  type DemoPost,
  type DemoState,
} from './marketplace-demo'

const mmk = (value: number) => `${value.toLocaleString()} MMK`
type Notice = { tone: 'success' | 'error' | 'info'; text: string }

export function MarketplaceDemoPage() {
  if (!isMarketplaceDemoEnabled()) return <Navigate to="/marketplace" replace />
  return <MarketplaceDemo />
}

function MarketplaceDemo() {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<DemoState>(() => loadDemoState())
  const [tick, setTick] = useState(() => Date.now())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [boostTarget, setBoostTarget] = useState<DemoPost | null>(null)
  const [paying, setPaying] = useState(false)
  const [showExpiry, setShowExpiry] = useState(false)
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')

  useEffect(() => saveDemoState(state), [state])
  // Re-check boost status every 30 seconds so expiry shows without a reload.
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // The timer only forces a re-render; the time itself is read fresh on every render.
  const now = demoNow(state, Math.max(tick, Date.now()))
  const quota = quotaFor(state, now)
  const posts = useMemo(() => rankedPosts(state, now), [state, now])
  const formatTime = (time: number) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time))
  const remaining = (expiresAt: number) => {
    const minutes = Math.max(0, Math.round((expiresAt - now) / 60_000))
    return t('marketplaceDemo.timeLeft', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
  }

  const run = (change: (current: DemoState) => DemoState, success?: string) => {
    try {
      setState((current) => change(current))
      if (success) setNotice({ tone: 'success', text: success })
    } catch (error) {
      const code = error instanceof DemoError ? error.code : 'INVALID'
      setNotice({ tone: 'error', text: t(`marketplaceDemo.error.${code}`) })
    }
  }

  // setState with a throwing updater would throw inside React; check against the current state first.
  const apply = (change: (current: DemoState) => DemoState, success?: string) => {
    try {
      const next = change(state)
      setState(next)
      if (success) setNotice({ tone: 'success', text: success })
      return true
    } catch (error) {
      const code = error instanceof DemoError ? error.code : 'INVALID'
      setNotice({ tone: 'error', text: t(`marketplaceDemo.error.${code}`) })
      return false
    }
  }

  const onCreate = (event: FormEvent) => {
    event.preventDefault()
    if (apply((current) => createPost(current, { title, priceMmk: Number(price), category: 'Sample' }, now), t('marketplaceDemo.created'))) {
      setTitle('')
      setPrice('')
    }
  }

  const createSamples = () => {
    let next = state
    let made = 0
    for (const sample of SAMPLE_POSTS) {
      if (quotaFor(next, now).remaining <= 0) break
      next = createPost(next, sample, now + made)
      made += 1
      if (made === 3) break
    }
    if (made === 0) {
      setNotice({ tone: 'error', text: t('marketplaceDemo.error.LIMIT_REACHED') })
      return
    }
    setState(next)
    setNotice({ tone: 'success', text: t('marketplaceDemo.samplesCreated', { count: made }) })
  }

  const firstEligible = posts.find((post) => !activeBoost(state, post.id, now)) ?? null

  const pay = (outcome: 'SUCCESS' | 'FAILED') => {
    if (!boostTarget) return
    setPaying(true)
    // A short pause so the "processing" state is visible; nothing leaves the browser.
    window.setTimeout(() => {
      const ok = apply((current) => boostPost(current, boostTarget.id, outcome, demoNow(current)))
      setPaying(false)
      if (!ok) return
      setNotice(
        outcome === 'SUCCESS'
          ? { tone: 'success', text: t('marketplaceDemo.boostSuccess', { title: boostTarget.title }) }
          : { tone: 'error', text: t('marketplaceDemo.boostFailed', { title: boostTarget.title }) },
      )
      setBoostTarget(null)
    }, 600)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-xs font-bold tracking-wide text-gold-ink">
            <FlaskConical className="size-3.5" aria-hidden />
            {t('marketplaceDemo.badge')}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{t('marketplaceDemo.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('marketplaceDemo.subtitle')}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/marketplace">{t('marketplaceDemo.exit')}</Link>
        </Button>
      </div>

      <p className="rounded-xl border border-gold/40 bg-gold-soft p-4 text-sm text-gold-ink" role="note">
        {t('marketplaceDemo.notice')}
      </p>

      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-start gap-2 rounded-xl border p-3 text-sm',
            notice.tone === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
            notice.tone === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive',
            notice.tone === 'info' && 'bg-muted',
          )}
        >
          {notice.tone === 'error' ? <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {notice.text}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3" aria-label={t('marketplaceDemo.summary')}>
            <Fact label={t('marketplaceDemo.user')} value={state.user} />
            <Fact label={t('marketplaceDemo.boostPrice')} value={mmk(DEMO_BOOST_PRICE_MMK)} />
            <Fact label={t('marketplaceDemo.boostDuration')} value={t('marketplaceDemo.hours', { count: DEMO_BOOST_HOURS })} />
          </section>
          <PostQuotaMeter quota={{ ...quota, resetsAt: new Date(quota.resetsAt).toISOString() }} />

          <form onSubmit={onCreate} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="demo-title">{t('marketplaceDemo.postTitle')}</Label>
              <Input id="demo-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('marketplaceDemo.postTitlePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-price">{t('marketplaceDemo.price')}</Label>
              <Input id="demo-price" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ''))} placeholder="50000" />
            </div>
            <Button type="submit" disabled={quota.remaining <= 0 || !title.trim() || !price}>
              <Plus aria-hidden />
              {t('marketplaceDemo.createPost')}
            </Button>
          </form>

          <section aria-labelledby="demo-posts-title" className="space-y-3">
            <h2 id="demo-posts-title" className="text-lg font-semibold">
              {t('marketplaceDemo.posts')}
            </h2>
            {posts.length === 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t('marketplaceDemo.empty')}</p>
            ) : (
              <ol className="space-y-3">
                {posts.map((post) => {
                  const boost = activeBoost(state, post.id, now)
                  const isEditing = editing?.id === post.id
                  return (
                    <li
                      key={post.id}
                      data-demo-post={post.id}
                      className={cn('rounded-xl border bg-card p-4 shadow-sm transition-colors', boost && 'border-gold/60 bg-gold-soft/60')}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          {boost ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold-soft px-2 py-0.5 text-[11px] font-bold tracking-wide text-gold-ink">
                              <Rocket className="size-3" aria-hidden />
                              {t('marketplaceDemo.boostedBadge')}
                            </span>
                          ) : null}
                          {isEditing ? (
                            <form
                              className="flex gap-2"
                              onSubmit={(event) => {
                                event.preventDefault()
                                if (apply((current) => editPost(current, post.id, editing.title), t('marketplaceDemo.edited'))) setEditing(null)
                              }}
                            >
                              <Input aria-label={t('marketplaceDemo.postTitle')} value={editing.title} onChange={(event) => setEditing({ id: post.id, title: event.target.value })} />
                              <Button type="submit" size="sm">{t('common.save')}</Button>
                            </form>
                          ) : (
                            <p className="font-semibold">{post.title}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {mmk(post.priceMmk)} · {post.category}
                          </p>
                          {boost ? (
                            <p className="flex flex-wrap items-center gap-x-3 text-xs text-gold-ink dark:text-amber-200">
                              <span>{t('marketplaceDemo.activatedAt', { time: formatTime(boost.activatedAt) })}</span>
                              <span>{t('marketplaceDemo.expiresAt', { time: formatTime(boost.expiresAt) })}</span>
                              <span className="font-semibold">{remaining(boost.expiresAt)}</span>
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {boost ? (
                            <Button type="button" size="sm" variant="secondary" disabled>
                              <Rocket aria-hidden />
                              {t('marketplaceDemo.boostActive')}
                            </Button>
                          ) : (
                            <Button type="button" size="sm" variant="cta" onClick={() => setBoostTarget(post)}>
                              <Rocket aria-hidden />
                              {t('marketplaceDemo.boostPost')}
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="outline" aria-label={t('marketplaceDemo.editPost', { title: post.title })} onClick={() => setEditing({ id: post.id, title: post.title })}>
                            <Pencil aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            aria-label={t('marketplaceDemo.deletePost', { title: post.title })}
                            onClick={() => apply((current) => deletePost(current, post.id), t('marketplaceDemo.deleted'))}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-3 self-start rounded-xl border bg-card p-4 lg:sticky lg:top-[calc(var(--site-header-h,0px)+1rem)]" aria-labelledby="demo-controls-title">
          <h2 id="demo-controls-title" className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-gold" aria-hidden />
            {t('marketplaceDemo.controls')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('marketplaceDemo.clock')}: <span className="font-medium text-foreground">{formatTime(now)}</span>
          </p>
          <div className="grid gap-2">
            <Button type="button" variant="outline" onClick={createSamples}>
              <Plus aria-hidden />
              {t('marketplaceDemo.createSamples')}
            </Button>
            <Button type="button" variant="outline" disabled={!firstEligible} onClick={() => firstEligible && setBoostTarget(firstEligible)}>
              <Rocket aria-hidden />
              {t('marketplaceDemo.simulateBoost')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!firstEligible}
              onClick={() => {
                if (!firstEligible) return
                if (apply((current) => boostPost(current, firstEligible.id, 'FAILED', now))) {
                  setNotice({ tone: 'error', text: t('marketplaceDemo.boostFailed', { title: firstEligible.title }) })
                }
              }}
            >
              <XCircle aria-hidden />
              {t('marketplaceDemo.simulateFailure')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowExpiry((value) => !value)} aria-expanded={showExpiry}>
              <Clock aria-hidden />
              {t('marketplaceDemo.viewExpiry')}
            </Button>
            {showExpiry ? (
              <ul className="space-y-1 rounded-lg bg-muted p-3 text-xs">
                {state.boosts.length === 0 ? <li>{t('marketplaceDemo.noBoosts')}</li> : null}
                {state.boosts.map((boost) => {
                  const post = state.posts.find((item) => item.id === boost.postId)
                  const live = boost.activatedAt <= now && now < boost.expiresAt
                  return (
                    <li key={boost.reference}>
                      <span className="font-medium">{post?.title ?? boost.postId}</span> — {formatTime(boost.expiresAt)} ·{' '}
                      {live ? remaining(boost.expiresAt) : t('marketplaceDemo.expired')}
                    </li>
                  )
                })}
              </ul>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => run((current) => advanceClock(current, DEMO_BOOST_HOURS * 60 * 60 * 1000), t('marketplaceDemo.advanced24'))}
            >
              <CalendarClock aria-hidden />
              {t('marketplaceDemo.advance24')}
            </Button>
            <Button type="button" variant="outline" onClick={() => run((current) => advanceToNextMonth(current), t('marketplaceDemo.advancedMonth'))}>
              <CalendarClock aria-hidden />
              {t('marketplaceDemo.advanceMonth')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setState(resetDemoState())
                setNotice({ tone: 'info', text: t('marketplaceDemo.resetDone') })
              }}
            >
              <RotateCcw aria-hidden />
              {t('marketplaceDemo.reset')}
            </Button>
          </div>
          {state.payments.length > 0 ? (
            <div className="space-y-1 border-t pt-3 text-xs">
              <p className="font-semibold">{t('marketplaceDemo.payments')}</p>
              <ul className="space-y-1 text-muted-foreground">
                {[...state.payments].reverse().slice(0, 6).map((payment) => (
                  <li key={payment.reference}>
                    {payment.reference} · {mmk(payment.amountMmk)} ·{' '}
                    <span className={payment.outcome === 'SUCCESS' ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'}>
                      {t(`marketplaceDemo.outcome.${payment.outcome}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {boostTarget ? <BoostDialog post={boostTarget} paying={paying} onCancel={() => setBoostTarget(null)} onPay={pay} /> : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function BoostDialog({ post, paying, onCancel, onPay }: { post: DemoPost; paying: boolean; onCancel: () => void; onPay: (outcome: 'SUCCESS' | 'FAILED') => void }) {
  const { t } = useTranslation()
  const titleId = useId()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !paying) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [paying, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 [&>[role=dialog]]:my-auto">
      <div aria-hidden className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !paying && onCancel()} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-overlay">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-gold-ink">
          <FlaskConical className="size-3.5" aria-hidden />
          {t('marketplaceDemo.badge')}
        </p>
        <h2 id={titleId} className="text-xl font-semibold tracking-tight">
          {t('marketplaceDemo.boostTitle')}
        </h2>
        <dl className="space-y-1.5 rounded-xl bg-muted p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('marketplaceDemo.post')}</dt>
            <dd className="text-right font-semibold">{post.title}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('marketplaceDemo.boostPrice')}</dt>
            <dd className="font-semibold tabular-nums">{mmk(DEMO_BOOST_PRICE_MMK)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('marketplaceDemo.boostDuration')}</dt>
            <dd className="font-semibold">{t('marketplaceDemo.hours', { count: DEMO_BOOST_HOURS })}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">{t('marketplaceDemo.noRealPayment')}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={paying} autoFocus onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={paying} onClick={() => onPay('FAILED')}>
            {t('marketplaceDemo.payFail')}
          </Button>
          <Button type="button" disabled={paying} onClick={() => onPay('SUCCESS')}>
            {paying ? t('marketplaceDemo.processing') : t('marketplaceDemo.payConfirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
