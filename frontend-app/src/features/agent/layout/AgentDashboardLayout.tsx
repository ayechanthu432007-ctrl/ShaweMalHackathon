import { useQuery } from '@tanstack/react-query'
import {
  ChartNoAxesCombined,
  CreditCard,
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
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'

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

type NavItem = { to: string; labelKey: string; icon: LucideIcon; show?: (dashboard: AgentDashboard) => boolean; end?: boolean }

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
  { to: '/agent/subscription', labelKey: 'agentDash.nav.subscription', icon: CreditCard },
  { to: '/profile', labelKey: 'agentDash.nav.settings', icon: Settings },
]

export function AgentDashboardLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const dashboardQuery = useAgentDashboard()
  const dashboard = dashboardQuery.data
  const current = `${location.pathname}${location.search}`

  if (isBootstrapping) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  // The agent area is for signed-in users only; the API enforces the same rule.
  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: current }} />
  }

  const items = NAV_ITEMS.filter((item) => !item.show || (dashboard ? item.show(dashboard) : false))

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3">
        {dashboard ? (
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="text-xs text-muted-foreground">{t('agentDash.currentPlan')}</p>
            <p className="text-lg font-semibold">{dashboard.plan.name}</p>
            {dashboard.subscription.status === 'ACTIVE' ? (
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

        <nav aria-label={t('agentDash.navLabel')} className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {items.map((item) => {
            const Icon = item.icon
            // Items that differ only by query string are matched on the full address.
            const isActive = item.to.includes('?') ? current === item.to : item.end ? current === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent font-medium text-accent-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {t(item.labelKey)}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
