import { useEffect, useState, useRef } from 'react'
import { ClipboardList, Home, Menu, Store, Truck, Users, X, type LucideIcon } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { FloatingContactButtons } from '@/components/common/FloatingContactButtons'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import { NotificationsMenu } from '@/features/notifications/components/NotificationsMenu'
import { UserMenu } from '@/features/public/components/UserMenu'
import shawemalLogo from '@/assets/shawemal-logo.png'
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
  '/driver/jobs': Truck,
  '/finding-roommates': Users,
  '/marketplace': Store,
}

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
          'shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          // In the navy bar on desktop; inside the white dropdown on phones.
          'text-foreground/75 hover:bg-muted hover:text-foreground lg:text-header-foreground/80 lg:hover:bg-white/10 lg:hover:text-header-foreground',
          isActive && 'bg-gold/15 text-gold-hover lg:bg-white/10 lg:text-gold lg:hover:text-gold',
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
      className={({ isActive }) =>
        cn(
          'group relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium text-header-foreground/70 transition-colors duration-200 hover:text-header-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          // The brand-coloured bar under the current page.
          'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gold after:opacity-0 after:transition-opacity after:duration-200 hover:after:opacity-30',
          isActive && 'text-header-foreground after:opacity-100 hover:after:opacity-100',
        )
      }
    >
      {Icon ? <Icon className="size-4 shrink-0 opacity-80" aria-hidden /> : null}
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
      <header ref={headerRef} className="sticky top-0 z-40 bg-header text-header-foreground shadow-[0_8px_24px_-12px_rgba(20,43,74,0.45)]">
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
              className="size-10 rounded-xl bg-white object-contain p-0.5 shadow-sm"
            />
            <span className="text-xl font-extrabold tracking-tight">{t('common.appName')}</span>
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
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 lg:ml-2 lg:border-l lg:border-white/15 lg:pl-4 [&_button]:border-white/20 [&_button]:bg-white/10 [&_button]:text-header-foreground [&_button]:shadow-none [&_button:hover]:bg-white/20 [&_button:hover]:text-header-foreground">
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
        <nav className="border-t border-white/10 bg-header-sub" aria-label="Sub">
          {/* On narrow screens the row scrolls sideways inside itself; the page never does. */}
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
            {subLinks.map((link) => (
              <SubNavItem key={link.to} to={link.to} label={t(link.labelKey)} />
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
