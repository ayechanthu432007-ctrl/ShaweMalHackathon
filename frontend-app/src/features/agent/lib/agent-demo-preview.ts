import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'

import type { AgentDashboard, Plan } from '../api/agent-plan-api'

/**
 * Agent demo preview: a plan choice and boosts kept only in this browser, per account.
 *
 * It exists because the live API refuses simulated payments (production), so nothing on the
 * server can change. The preview changes only what the agent's own pages display: no order,
 * payment, subscription or boost is created, plan features and limits stay on the real plan,
 * and public listing order is unchanged. It is on only when the build sets
 * VITE_DEMO_PLAN_PREVIEW=true and the server's own demo checkout is unavailable.
 */
export const isDemoPreviewEnabled = () => import.meta.env.VITE_DEMO_PLAN_PREVIEW === 'true'

export type DemoPlanChoice = { code: string; billingMonths: 1 | 3; chosenAt: number }
export type DemoBoost = { id: string; houseId: string; title: string; days: number; amountMmk: number; activatedAt: number; expiresAt: number }
export type DemoPreviewState = { plan: DemoPlanChoice | null; boosts: DemoBoost[] }

const EMPTY: DemoPreviewState = { plan: null, boosts: [] }
const CHANGE_EVENT = 'shawemal:agent-demo-preview'
const DAY_MS = 24 * 60 * 60 * 1000
const keyFor = (userId: string) => `shawemal.agentDemoPreview.${userId}`
// The plan page's earlier storage key; read once so a choice made before this update is kept.
const legacyKeyFor = (userId: string) => `shawemal.demoPlanPreview.${userId}`

export function readDemoPreview(userId: string | undefined): DemoPreviewState {
  if (!userId) return EMPTY
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as DemoPreviewState) }
    const legacy = localStorage.getItem(legacyKeyFor(userId))
    if (legacy) {
      const old = JSON.parse(legacy) as { code: string; billingMonths: 1 | 3 }
      return { ...EMPTY, plan: { ...old, chosenAt: Date.now() } }
    }
  } catch {
    // Unreadable storage behaves like an empty demo.
  }
  return EMPTY
}

function writeDemoPreview(userId: string, state: DemoPreviewState) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(state))
    localStorage.removeItem(legacyKeyFor(userId))
  } catch {
    // Storage can be blocked; the demo then lasts until the page is left.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

export class DemoBoostError extends Error {
  code: 'ALREADY_BOOSTED' | 'INVALID'
  constructor(code: 'ALREADY_BOOSTED' | 'INVALID') {
    super(code)
    this.code = code
  }
}

export const activeDemoBoost = (state: DemoPreviewState, houseId: string, now = Date.now()) =>
  state.boosts.find((boost) => boost.houseId === houseId && boost.activatedAt <= now && now < boost.expiresAt) ?? null

/** Adds a simulated boost; a listing already boosted in the demo is never charged again. */
export function withDemoBoost(state: DemoPreviewState, input: { houseId: string; title: string; days: number; amountMmk: number }, now = Date.now()): DemoPreviewState {
  if (!input.houseId || input.days < 1) throw new DemoBoostError('INVALID')
  if (activeDemoBoost(state, input.houseId, now)) throw new DemoBoostError('ALREADY_BOOSTED')
  const boost: DemoBoost = { id: `demo-boost-${now}`, ...input, activatedAt: now, expiresAt: now + input.days * DAY_MS }
  return { ...state, boosts: [boost, ...state.boosts] }
}

/** The demo state for the signed-in agent, kept in sync across every page and tab. */
export function useAgentDemoPreview(dashboard: Pick<AgentDashboard, 'demoPayments'> | undefined) {
  const { user } = useAuth()
  const userId = user?.id
  const enabled = Boolean(dashboard && !dashboard.demoPayments && isDemoPreviewEnabled())
  const [state, setState] = useState<DemoPreviewState>(() => readDemoPreview(userId))

  useEffect(() => {
    const sync = () => setState(readDemoPreview(userId))
    sync()
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [userId])

  const update = useCallback(
    (change: (current: DemoPreviewState) => DemoPreviewState) => {
      if (!userId) return
      const next = change(readDemoPreview(userId))
      writeDemoPreview(userId, next)
      setState(next)
    },
    [userId],
  )

  return {
    enabled,
    state: enabled ? state : EMPTY,
    update,
    reset: () => update(() => EMPTY),
  }
}

/** The plan to display: the demo choice when the preview is on, otherwise the real one. */
export function displayedPlan(dashboard: Pick<AgentDashboard, 'plan' | 'plans'>, preview: { enabled: boolean; state: DemoPreviewState }): { plan: Plan; isDemo: boolean } {
  const choice = preview.enabled ? preview.state.plan : null
  const plan = choice ? dashboard.plans.find((item) => item.code === choice.code) : undefined
  return plan ? { plan, isDemo: true } : { plan: dashboard.plan, isDemo: false }
}
