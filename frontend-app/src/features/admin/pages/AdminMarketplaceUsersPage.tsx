import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { selectClassName } from '@/features/marketplace/components/MarketplaceDialog'
import { SellerBadges } from '@/features/marketplace/components/SellerBadges'
import { formatDate } from '@/features/marketplace/lib/marketplace-format'
import type { AccountStatus } from '@/features/marketplace/types'

import { adminMarketplaceApi, type AdminUserFilters } from '../api/admin-marketplace-api'
import { AdminMarketplaceNav, Pager, StatusPill } from '../components/AdminMarketplaceNav'
import { ACCOUNT_STATUS_TONE } from '../lib/marketplace-tones'

const VERIFICATION_FILTERS = ['phone_unverified', 'phone_verified', 'identity_verified', 'trusted'] as const

export function AdminMarketplaceUsersPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters: AdminUserFilters = {
    q: searchParams.get('q') ?? undefined,
    accountStatus: (searchParams.get('accountStatus') ?? undefined) as AccountStatus | undefined,
    verification: (searchParams.get('verification') ?? undefined) as AdminUserFilters['verification'],
    reported: searchParams.get('reported') === 'true' ? 'true' : undefined,
    page: Number(searchParams.get('page') ?? '1') || 1,
  }
  const [q, setQ] = useState(filters.q ?? '')

  const usersQuery = useQuery({
    queryKey: ['admin', 'marketplace', 'users', filters],
    queryFn: () => adminMarketplaceApi.listUsers(filters),
  })

  const update = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    update('q', q.trim() || undefined)
  }

  const data = usersQuery.data

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('admin.marketplace.users.title')}</h1>
      <AdminMarketplaceNav />

      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
        <form className="flex gap-2 md:col-span-3" onSubmit={onSearch} role="search">
          <Input aria-label={t('admin.marketplace.users.search')} placeholder={t('admin.marketplace.users.search')} value={q} onChange={(event) => setQ(event.target.value)} />
          <Button type="submit">{t('marketplace.searchAction')}</Button>
        </form>
        <select aria-label={t('admin.marketplace.users.accountStatus')} className={selectClassName} value={filters.accountStatus ?? ''} onChange={(event) => update('accountStatus', event.target.value || undefined)}>
          <option value="">{t('admin.marketplace.users.anyAccountStatus')}</option>
          {(['ACTIVE', 'SUSPENDED', 'BANNED'] as const).map((status) => (
            <option key={status} value={status}>
              {t(`admin.marketplace.accountStatus.${status}`)}
            </option>
          ))}
        </select>
        <select aria-label={t('admin.marketplace.users.verification')} className={selectClassName} value={filters.verification ?? ''} onChange={(event) => update('verification', event.target.value || undefined)}>
          <option value="">{t('admin.marketplace.users.anyVerification')}</option>
          {VERIFICATION_FILTERS.map((value) => (
            <option key={value} value={value}>
              {t(`admin.marketplace.users.verificationFilters.${value}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.reported === 'true'} onChange={(event) => update('reported', event.target.checked ? 'true' : undefined)} />
          {t('admin.marketplace.users.reportedOnly')}
        </label>
      </div>

      {usersQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
      {usersQuery.isError ? <p className="text-sm text-destructive">{t('admin.marketplace.loadError')}</p> : null}

      {data ? (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">{t('admin.marketplace.users.user')}</th>
                  <th className="p-3">{t('admin.marketplace.users.verification')}</th>
                  <th className="p-3">{t('admin.marketplace.users.accountStatus')}</th>
                  <th className="p-3">{t('admin.marketplace.users.listings')}</th>
                  <th className="p-3">{t('admin.marketplace.users.openReports')}</th>
                  <th className="p-3">{t('admin.marketplace.users.joined')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <Link to={`/admin/marketplace/users/${user.id}`} className="font-medium hover:underline">
                        {user.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{user.email} · {user.phone}</p>
                    </td>
                    <td className="p-3">
                      <SellerBadges badges={user.badges} />
                    </td>
                    <td className="p-3">
                      <StatusPill tone={ACCOUNT_STATUS_TONE[user.accountStatus]}>{t(`admin.marketplace.accountStatus.${user.accountStatus}`)}</StatusPill>
                    </td>
                    <td className="p-3">{user.listingCount}</td>
                    <td className="p-3">{user.openReportCount > 0 ? <StatusPill tone="bg-destructive/15 text-destructive">{user.openReportCount}</StatusPill> : '—'}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} totalPages={data.totalPages} onPage={(page) => update('page', String(page))} />
        </>
      ) : null}
    </section>
  )
}
