import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Separator } from '@/components/ui/separator'
import { NotificationsMenu } from '@/features/notifications/components/NotificationsMenu'
import { UserMenu } from '@/features/public/components/UserMenu'
import shawemalLogo from '@/assets/shawemal-logo.jpg'
import { cn } from '@/lib/utils'

const guestTopLinks = [
  { to: '/', labelKey: 'nav.home', end: true },
  { to: '/about-us', labelKey: 'nav.aboutUs' },
  { to: '/agent-register', labelKey: 'nav.agentRegister' },
  { to: '/driver-register', labelKey: 'nav.driverRegister' },
  { to: '/sign-up', labelKey: 'nav.signUp' },
  { to: '/sign-in', labelKey: 'nav.signIn' },
] as const

const authTopLinks = [
  { to: '/', labelKey: 'nav.home', end: true },
  { to: '/about-us', labelKey: 'nav.aboutUs' },
  { to: '/agent-register', labelKey: 'nav.agentRegister' },
  { to: '/driver-register', labelKey: 'nav.driverRegister' },
] as const

function buildPublicSubLinks(options: { isAgent: boolean; isDriver: boolean }) {
  return [
    { to: '/finding-house', labelKey: 'nav.findingHouse' },
    ...(options.isAgent ? [{ to: '/agent/houses', labelKey: 'nav.postHousingInformation' }] : []),
    { to: '/hire-moving', labelKey: 'nav.hireMoving' },
    { to: '/moving-status', labelKey: 'nav.movingStatus' },
    ...(options.isDriver ? [{ to: '/driver/jobs', labelKey: 'nav.driverJobs' }] : []),
    { to: '/finding-roommates', labelKey: 'nav.findingRoommates' },
    { to: '/marketplace', labelKey: 'nav.marketplace' },
  ]
}

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-accent text-accent-foreground font-medium',
        )
      }
    >
      {label}
    </NavLink>
  )
}

export function PublicLayout() {
  const { t } = useTranslation()
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const topLinks = isAuthenticated ? authTopLinks : guestTopLinks
  const isAgent = Boolean(user?.roles?.includes('agent'))
  const isDriver = Boolean(user?.roles?.includes('driver'))
  const subLinks = buildPublicSubLinks({ isAgent, isDriver })

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-secondary text-secondary-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex shrink-0 items-center gap-3">
            <img
              src={shawemalLogo}
              alt=""
              className="h-9 w-9 rounded-md object-cover"
            />
            <span className="text-xl font-bold tracking-tight">{t('common.appName')}</span>
          </div>
          <nav className="hidden min-w-0 flex-1 items-center justify-end gap-1 md:flex" aria-label="Primary">
            {topLinks.map((link) => (
              <NavItem key={link.to} to={link.to} label={t(link.labelKey)} end={'end' in link ? link.end : false} />
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {!isBootstrapping && isAuthenticated ? (
              <>
                <NotificationsMenu />
                <UserMenu />
              </>
            ) : null}
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <Separator />
        <nav className="bg-muted text-foreground" aria-label="Sub">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
            {subLinks.map((link) => (
              <NavItem key={link.to} to={link.to} label={t(link.labelKey)} />
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
