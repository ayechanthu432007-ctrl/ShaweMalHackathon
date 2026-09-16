import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

const links = [
  { to: '/admin/marketplace', labelKey: 'admin.marketplace.nav.overview', end: true },
  { to: '/admin/marketplace/listings', labelKey: 'admin.marketplace.nav.listings' },
  { to: '/admin/marketplace/reports', labelKey: 'admin.marketplace.nav.reports' },
  { to: '/admin/marketplace/users', labelKey: 'admin.marketplace.nav.users' },
] as const

export function AdminMarketplaceNav() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('admin.marketplace.navLabel')} className="flex flex-wrap gap-1 border-b pb-2">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={'end' in link ? link.end : false}
          className={({ isActive }) =>
            cn('rounded-md px-3 py-1.5 text-sm hover:bg-accent', isActive && 'bg-accent font-medium')
          }
        >
          {t(link.labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      <button type="button" className="rounded-md border px-3 py-1.5 disabled:opacity-50" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t('common.previous')}
      </button>
      <span className="text-muted-foreground">{t('marketplace.search.pageStatus', { page, total: totalPages })}</span>
      <button type="button" className="rounded-md border px-3 py-1.5 disabled:opacity-50" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        {t('common.next')}
      </button>
    </div>
  )
}

export function StatusPill({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', tone ?? 'bg-muted')}>{children}</span>
}
