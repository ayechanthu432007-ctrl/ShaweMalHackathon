import { Suspense, useEffect, useState, useRef } from 'react'
import { ClipboardList, Home, Menu, Plus, Store, Truck, Users, X, type LucideIcon } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { prefetchProps } from '@/app/router/prefetch-pages'
import { FloatingContactButtons } from '@/components/common/FloatingContactButtons'
import { LoadingState } from '@/components/common/PageStates'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import { NotificationsMenu } from '@/features/notifications/components/NotificationsMenu'
import { UserMenu } from '@/features/public/components/UserMenu'
// The transparent version of the logo, so it sits directly on the header colour.
import shawemalLogo from '@/assets/shawemal-logo-mark.png'
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

const SUB_LINK_ICONS: Record<string, LucideIcon> = {
  '/finding-house': Home,
  '/agent/houses': Home,
  '/hire-moving': Truck,
  '/moving-status': ClipboardList,
  '/finding-roommates': Users,
  '/marketplace': Store,
}

const publicSubLinks = [
  { to: '/finding-house', labelKey: 'nav.sub.housing' },
  { to: '/hire-moving', labelKey: 'nav.sub.moving' },
  { to: '/moving-status', labelKey: 'nav.sub.trackMove' },
  { to: '/finding-roommates', labelKey: 'nav.sub.roommates' },
  { to: '/marketplace', labelKey: 'nav.marketplace' },
] as const

function NavItem({ to, label, end, onClick }: { to: string; label: string; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      {...prefetchProps(to)}
      className={({ isActive }) =>
        cn(
          'shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          // In the navy bar on desktop; inside the white dropdown on phones.
          'text-foreground/75 hover:bg-muted hover:text-foreground lg:text-header-foreground/80 lg:hover:bg-header-hover lg:hover:text-header-foreground',
          isActive && 'bg-gold-soft font-semibold text-gold-ink lg:bg-white/45 lg:font-semibold lg:text-header-foreground lg:hover:text-header-foreground dark:lg:bg-header-hover dark:lg:text-gold',
        )
      }
    >
      {label}
    </NavLink>
  )
}

function SubNavItem({ to, label }: { to: string; label: string }) {
  const Icon = SUB_LINK_ICONS[to]
  return (
    <NavLink
      to={to}
      {...prefetchProps(to)}
      className={({ isActive }) =>
        cn(
          'group relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium text-header-sub-foreground transition-colors duration-200 hover:bg-header-sub-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none',
          // The deep-blue bar under the current section.
          'after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-header-sub-active after:opacity-0 after:transition-opacity after:duration-200 hover:after:opacity-25',
          isActive && 'font-semibold text-header-sub-active after:opacity-100 hover:after:opacity-100 dark:text-header-sub-foreground',
        )
      }
    >
      {Icon ? <Icon className="size-4 shrink-0 text-header-sub-muted group-aria-[current=page]:text-header-sub-active" aria-hidden /> : null}
      {label}
    </NavLink>
  )
}

/**
 * A role's main action, kept apart from the browsing links at the right end of the second row
 * (the pattern Booking.com and Zillow use for "List your property" / "Manage rentals"). Shown only
 * to signed-in agents (listings) and drivers (jobs); each page and its API check the role again.
 */
function RoleAction({ to, icon: Icon, label, shortLabel }: { to: string; icon: LucideIcon; label: string; shortLabel: string }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'my-1.5 inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold shadow-card transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          // Brand yellow: the role's main action, like every other forward action on the site.
          'border-cta-border bg-cta text-cta-foreground hover:bg-cta-hover',
          isActive && 'ring-2 ring-header-sub-active/40',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{shortLabel}</span>
    </NavLink>
  )
}

export function PublicLayout() {
  const { t } = useTranslation()
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const topLinks = isAuthenticated ? authTopLinks : guestTopLinks
  const isAgent = Boolean(user?.roles?.includes('agent'))
  const isDriver = Boolean(user?.roles?.includes('driver'))
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    if (!isMenuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen])

  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const header = headerRef.current
    if (!header || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const update = () => root.style.setProperty('--site-header-h', `${header.offsetHeight}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--site-header-h')
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Both rows stay at the top while the page scrolls; its height is shared as --site-header-h. */}
      <header ref={headerRef} className="sticky top-0 z-40 bg-header text-header-foreground shadow-raised">
        {isMenuOpen ? (
          // Tapping anywhere outside the open menu closes it.
          <div className="fixed inset-0 z-40 lg:hidden" aria-hidden onClick={() => setIsMenuOpen(false)} />
        ) : null}
        <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-x-2 px-4 sm:gap-x-4">
          <Link
            to="/"
            onClick={() => setIsMenuOpen(false)}
            className="flex shrink-0 items-center gap-2 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3"
          >
            <img
              src={shawemalLogo}
              alt=""
              className="size-11 object-contain sm:size-12"
            />
            {/* Signed-in phones need the room for the account buttons; the name stays for screen readers. */}
            <span className={cn('text-xl font-extrabold tracking-tight', isAuthenticated && 'max-[399px]:sr-only')}>{t('common.appName')}</span>
          </Link>
          <nav
            id="primary-nav"
            className={cn(
              // Phones and tablets: a compact dropdown under the menu button, over the page.
              'absolute right-4 top-full z-50 mt-1 w-60 flex-col gap-1 rounded-2xl border bg-popover p-2 text-popover-foreground shadow-xl',
              // Desktop: the links sit in the header row.
              'lg:static lg:z-auto lg:mt-0 lg:flex lg:w-auto lg:min-w-0 lg:flex-1 lg:flex-row lg:items-center lg:justify-end lg:gap-0.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:text-inherit lg:shadow-none',
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
          {/* Header controls are translucent on the navy bar so their icons stay visible. */}
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 lg:ml-2 lg:border-l lg:border-header-line lg:pl-4 [&_button]:border-header-line [&_button]:bg-white/60 dark:[&_button]:bg-white/10 [&_button]:text-header-foreground [&_button]:shadow-none [&_button:hover]:bg-header-hover [&_button:hover]:text-header-foreground">
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
        <nav className="border-b border-header-sub-border bg-header-sub text-header-sub-foreground" aria-label="Sub">
          {/* On narrow screens the row scrolls sideways inside itself; the page never does. */}
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-2 sm:px-4">
            <div className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto max-sm:pr-8 max-sm:[mask-image:linear-gradient(to_right,black_88%,transparent)]">
              {publicSubLinks.map((link) => (
                <SubNavItem key={link.to} to={link.to} label={t(link.labelKey)} />
              ))}
            </div>
            {isAgent || isDriver ? <span className="hidden h-6 w-px shrink-0 bg-header-sub-border sm:block" aria-hidden /> : null}
            {isDriver ? <RoleAction to="/driver/jobs" icon={Truck} label={t('nav.driverJobs')} shortLabel={t('nav.driverJobs')} /> : null}
            {isAgent ? (
              <RoleAction to="/agent/houses" icon={Plus} label={t('nav.sub.listingDashboard')} shortLabel={t('nav.sub.listingDashboardShort')} />
            ) : null}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-28 sm:pb-12">
        {/* Header and footer stay put while a page's code loads. */}
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
      <FloatingContactButtons />
    </div>
  )
}
