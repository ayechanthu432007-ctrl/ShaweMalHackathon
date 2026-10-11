import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { FloatingContactButtons } from '@/components/common/FloatingContactButtons'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
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

function NavItem({ to, label, end, onClick }: { to: string; label: string; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
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
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    if (!isMenuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-secondary text-secondary-foreground">
        {isMenuOpen ? (
          // Tapping anywhere outside the open menu closes it.
          <div className="fixed inset-0 z-40 lg:hidden" aria-hidden onClick={() => setIsMenuOpen(false)} />
        ) : null}
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 sm:gap-x-4 lg:flex-nowrap">
          <Link
            to="/"
            onClick={() => setIsMenuOpen(false)}
            className="flex shrink-0 items-center gap-2 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3"
          >
            <img
              src={shawemalLogo}
              alt=""
              className="h-9 w-9 rounded-md object-cover"
            />
            <span className="text-xl font-bold tracking-tight">{t('common.appName')}</span>
          </Link>
          <nav
            id="primary-nav"
            className={cn(
              // Phones and tablets: a compact dropdown under the menu button, over the page.
              'absolute right-4 top-full z-50 -mt-1 w-56 flex-col gap-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg',
              // Desktop: the links sit in the header row.
              'lg:static lg:z-auto lg:mt-0 lg:flex lg:w-auto lg:min-w-0 lg:flex-1 lg:flex-row lg:items-center lg:justify-end lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:text-inherit lg:shadow-none',
              isMenuOpen ? 'flex' : 'hidden',
            )}
            aria-label="Primary"
          >
            {topLinks.map((link) => (
              <NavItem
                key={link.to}
                to={link.to}
                label={t(link.labelKey)}
                end={'end' in link ? link.end : false}
                onClick={() => setIsMenuOpen(false)}
              />
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
            {!isBootstrapping && isAuthenticated ? (
              <>
                <NotificationsMenu />
                <UserMenu />
              </>
            ) : null}
            <LanguageToggle />
            <ThemeToggle />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label={t('nav.menu')}
              aria-expanded={isMenuOpen}
              aria-controls="primary-nav"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
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
      <FloatingContactButtons />
    </div>
  )
}
