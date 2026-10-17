import { useQuery } from '@tanstack/react-query'
import {
  ChartNoAxesCombined,
  CreditCard,
  Crown,
  Eye,
  FileChartColumn,
  House,
  LayoutDashboard,
  MessagesSquare,
  Phone,
  Rocket,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Suspense } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { displayedPlan, useAgentDemoPreview } from '../lib/agent-demo-preview'

import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { cn } from '@/lib/utils'

import { agentPlanApi, formatDate, type AgentDashboard } from '../api/agent-plan-api'

export const AGENT_DASHBOARD_QUERY_KEY = ['agent', 'dashboard'] as const

/** The agent's plan, limits and feature permissions, as decided by the server. */
export function useAgentDashboard() {
  const { isAuthenticated, user } = useAuth()
  const isAgent = Boolean(user?.roles?.includes('agent'))
  return useQuery({
    // Cached per account, so one user's plan is never shown to the next person on this browser.
    queryKey: [...AGENT_DASHBOARD_QUERY_KEY, user?.id ?? 'signed-out'],
    queryFn: async () => (await agentPlanApi.dashboard()).dashboard,
    enabled: isAuthenticated && isAgent,
  })
}

type NavItem = {
  to: string
  labelKey: string
  icon: LucideIcon
  show?: (dashboard: AgentDashboard) => boolean
  end?: boolean
  /** Account items sit below a divider, apart from the day-to-day tools. */
  group?: 'account'
}

// Premium items are listed only when the server says the plan includes them.
const NAV_ITEMS: NavItem[] = [
  { to: '/agent/dashboard', labelKey: 'agentDash.nav.dashboard', icon: LayoutDashboard },
  { to: '/agent/houses', labelKey: 'agentDash.nav.listings', icon: House },
  { to: '/agent/performance?metric=views', labelKey: 'agentDash.nav.views', icon: Eye },
  { to: '/agent/bookings', labelKey: 'agentDash.nav.inquiries', icon: MessagesSquare },
  { to: '/agent/performance?metric=calls', labelKey: 'agentDash.nav.calls', icon: Phone },
  { to: '/agent/performance', labelKey: 'agentDash.nav.performance', icon: ChartNoAxesCombined, end: true },
  { to: '/agent/boosts', labelKey: 'agentDash.nav.boosts', icon: Rocket },
  { to: '/agent/verification', labelKey: 'agentDash.nav.badge', icon: ShieldCheck },
  { to: '/agent/insights', labelKey: 'agentDash.nav.insights', icon: Users, show: (d) => d.features.audienceInsights },
  { to: '/agent/reports', labelKey: 'agentDash.nav.reports', icon: FileChartColumn, show: (d) => d.features.monthlyReport },
  { to: '/agent/subscription', labelKey: 'agentDash.nav.subscription', icon: CreditCard, group: 'account' },
  { to: '/profile', labelKey: 'agentDash.nav.settings', icon: Settings, group: 'account' },
]

export function AgentDashboardLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const dashboardQuery = useAgentDashboard()
  const dashboard = dashboardQuery.data
  const current = `${location.pathname}${location.search}`
  // Hooks stay above the early returns below.
  const preview = useAgentDemoPreview(dashboard)

  if (isBootstrapping) {
    return <LoadingState />
  }

  // The agent area is for signed-in users only; the API enforces the same rule.
  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: current }} />
  }

  const items = NAV_ITEMS.filter((item) => !item.show || (dashboard ? item.show(dashboard) : false))
  const shown = dashboard ? displayedPlan(dashboard, preview) : null
  const isGold = shown?.plan.code === 'GOLD'

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3 lg:sticky lg:top-[calc(var(--site-header-h,0px)+1rem)] lg:self-start">
        {dashboard ? (
          <div className={cn('rounded-xl border p-4 text-sm shadow-sm', isGold ? 'border-amber-300/70 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'bg-card')}>
            <p className="text-xs text-muted-foreground">{t('agentDash.currentPlan')}</p>
            <p className="flex items-center gap-1.5 text-lg font-semibold">
              {isGold ? <Crown className="size-4 text-amber-500" aria-hidden /> : null}
              {shown?.plan.name}
              {shown?.isDemo ? <span className="rounded bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold text-gold-ink">DEMO</span> : null}
            </p>
            {shown?.isDemo ? <p className="text-xs text-muted-foreground">{t('agentDash.demoPlanSidebar', { plan: dashboard.plan.name })}</p> : null}
            {!shown?.isDemo && dashboard.subscription.status === 'ACTIVE' ? (
              <p className="text-xs text-muted-foreground">{t('agentDash.validUntil', { date: formatDate(dashboard.subscription.endsAt) })}</p>
            ) : null}
            {dashboard.subscription.status === 'EXPIRED' ? (
              <p className="mt-1 text-xs text-destructive">
                {t('agentDash.planExpired')}{' '}
                <Link to="/agent/subscription" className="font-medium underline underline-offset-4">
                  {t('agentDash.renew')}
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <nav
          aria-label={t('agentDash.navLabel')}
          className="scrollbar-none flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:rounded-xl lg:border lg:bg-card lg:p-2 lg:shadow-card"
        >
          {items.map((item, index) => {
            const Icon = item.icon
            // Items that differ only by query string are matched on the full address.
            const isActive = item.to.includes('?') ? current === item.to : item.end ? current === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
            const startsAccountGroup = item.group === 'account' && items[index - 1]?.group !== 'account'
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive && 'bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary',
                  startsAccountGroup && 'lg:mt-2 lg:border-t lg:pt-3 lg:rounded-t-none',
                )}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden />
                {t(item.labelKey)}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
