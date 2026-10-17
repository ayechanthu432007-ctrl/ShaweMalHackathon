import {
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Database,
  FileChartColumn,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Store,
  Truck,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { LoadingState } from '@/components/common/PageStates'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import shawemalLogo from '@/assets/shawemal-logo-mark.png'
import { cn } from '@/lib/utils'

type NavItem = { to: string; labelKey: string; icon: LucideIcon; end?: boolean }

const navItems: NavItem[] = [
  { to: '/admin/dashboard', labelKey: 'admin.nav.dashboard', icon: LayoutDashboard },
  { to: '/admin/master-data', labelKey: 'admin.nav.masterData', icon: Database },
  { to: '/admin/verifications/agents', labelKey: 'admin.nav.agentVerification', icon: ShieldCheck },
  { to: '/admin/verifications/drivers', labelKey: 'admin.nav.driverVerification', icon: UserCheck },
  { to: '/admin/users', labelKey: 'admin.nav.users', icon: Users },
  { to: '/admin/jobs-assign', labelKey: 'admin.nav.jobsAssign', icon: ClipboardList },
  { to: '/admin/marketplace', labelKey: 'admin.nav.marketplace', icon: Store },
  { to: '/admin/subscriptions', labelKey: 'admin.nav.subscriptions', icon: CreditCard },
  { to: '/admin/reports/moving', labelKey: 'admin.nav.movingReport', icon: Truck },
  { to: '/admin/reports/bookings', labelKey: 'admin.nav.bookingReport', icon: CalendarCheck },
  // Exact match only, so the two report pages above do not also highlight this one.
  { to: '/admin/reports', labelKey: 'admin.nav.reports', icon: FileChartColumn, end: true },
]

export function AdminLayout() {
  const { t } = useTranslation()
  const { logout, user } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      {/* Same brand-blue bar as the public site, so the admin portal reads as part of one product. */}
      <header className="bg-header text-header-foreground shadow-raised">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={shawemalLogo} alt="" className="size-10 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight">{t('admin.title')}</p>
              <p className="truncate text-sm text-header-foreground/80">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 [&_button]:border-header-line [&_button]:bg-white/60 [&_button]:text-header-foreground [&_button]:shadow-none [&_button:hover]:bg-header-hover dark:[&_button]:bg-white/10">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut aria-hidden />
              {t('auth.logout')}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-8">
        {/* A side bar on desktop; on phones and tablets the same links scroll sideways above the page. */}
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--site-header-h,0px)+1rem)] lg:self-start">
          <nav
            aria-label={t('admin.navLabel')}
            className="scrollbar-none flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:rounded-xl lg:border lg:bg-card lg:p-2 lg:shadow-card"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive && 'bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary',
                  )
                }
              >
                <item.icon className="size-[18px] shrink-0" aria-hidden />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
