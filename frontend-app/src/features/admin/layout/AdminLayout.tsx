import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/admin/dashboard', labelKey: 'admin.nav.dashboard' },
  { to: '/admin/master-data', labelKey: 'admin.nav.masterData' },
  { to: '/admin/verifications/agents', labelKey: 'admin.nav.agentVerification' },
  { to: '/admin/verifications/drivers', labelKey: 'admin.nav.driverVerification' },
  { to: '/admin/users', labelKey: 'admin.nav.users' },
  { to: '/admin/jobs-assign', labelKey: 'admin.nav.jobsAssign' },
  { to: '/admin/marketplace', labelKey: 'admin.nav.marketplace' },
  { to: '/admin/reports/moving', labelKey: 'admin.nav.movingReport' },
  { to: '/admin/reports/bookings', labelKey: 'admin.nav.bookingReport' },
  { to: '/admin/reports', labelKey: 'admin.nav.reports' },
] as const

export function AdminLayout() {
  const { t } = useTranslation()
  const { logout, user } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-secondary text-secondary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{t('admin.title')}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <Button variant="outline" onClick={() => void logout()}>
                {t('auth.logout')}
              </Button>
            </div>
          </div>
          <nav aria-label={t('admin.navLabel')} className="flex flex-wrap gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm hover:bg-accent',
                    isActive && 'bg-accent font-medium',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
