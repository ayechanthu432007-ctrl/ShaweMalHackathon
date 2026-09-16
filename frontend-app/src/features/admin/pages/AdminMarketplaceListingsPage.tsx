import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { selectClassName } from '@/features/marketplace/components/MarketplaceDialog'
import { formatDate, formatPrice } from '@/features/marketplace/lib/marketplace-format'
import type { ListingStatus, ModerationStatus } from '@/features/marketplace/types'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { adminMarketplaceApi } from '../api/admin-marketplace-api'
import { AdminMarketplaceNav, Pager, StatusPill } from '../components/AdminMarketplaceNav'
import { ACCOUNT_STATUS_TONE, MODERATION_STATUS_TONE } from '../lib/marketplace-tones'

export function AdminMarketplaceListingsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    q: searchParams.get('q') ?? undefined,
    status: (searchParams.get('status') ?? undefined) as ListingStatus | undefined,
    moderationStatus: (searchParams.get('moderationStatus') ?? undefined) as ModerationStatus | undefined,
    reported: searchParams.get('reported') === 'true' ? ('true' as const) : undefined,
    page: Number(searchParams.get('page') ?? '1') || 1,
  }
  const [q, setQ] = useState(filters.q ?? '')

  const listingsQuery = useQuery({
    queryKey: ['admin', 'marketplace', 'listings', filters],
    queryFn: () => adminMarketplaceApi.listListings(filters),
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

  const data = listingsQuery.data

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('admin.marketplace.listings.title')}</h1>
      <AdminMarketplaceNav />

      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
        <form className="flex gap-2 md:col-span-4" onSubmit={onSearch} role="search">
          <Input aria-label={t('admin.marketplace.listings.search')} placeholder={t('admin.marketplace.listings.search')} value={q} onChange={(event) => setQ(event.target.value)} />
          <Button type="submit">{t('marketplace.searchAction')}</Button>
        </form>
        <select aria-label={t('admin.marketplace.listings.moderation')} className={selectClassName} value={filters.moderationStatus ?? ''} onChange={(event) => update('moderationStatus', event.target.value || undefined)}>
          <option value="">{t('admin.marketplace.listings.anyModeration')}</option>
          {(['PENDING', 'APPROVED', 'REJECTED', 'REMOVED'] as const).map((status) => (
            <option key={status} value={status}>
              {t(`marketplace.moderation.${status}`)}
            </option>
          ))}
        </select>
        <select aria-label={t('admin.marketplace.listings.listingStatus')} className={selectClassName} value={filters.status ?? ''} onChange={(event) => update('status', event.target.value || undefined)}>
          <option value="">{t('admin.marketplace.listings.anyStatus')}</option>
          <option value="ACTIVE">{t('marketplace.status.ACTIVE')}</option>
          <option value="SOLD">{t('marketplace.status.SOLD')}</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.reported === 'true'} onChange={(event) => update('reported', event.target.checked ? 'true' : undefined)} />
          {t('admin.marketplace.listings.reportedOnly')}
        </label>
      </div>

      {listingsQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
      {listingsQuery.isError ? <p className="text-sm text-destructive">{t('admin.marketplace.loadError')}</p> : null}

      {data ? (
        <>
          <p className="text-sm text-muted-foreground">{t('marketplace.search.count', { count: data.total })}</p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">{t('admin.marketplace.listings.item')}</th>
                  <th className="p-3">{t('admin.marketplace.listings.seller')}</th>
                  <th className="p-3">{t('admin.marketplace.listings.moderation')}</th>
                  <th className="p-3">{t('admin.marketplace.listings.listingStatus')}</th>
                  <th className="p-3">{t('admin.marketplace.listings.reports')}</th>
                  <th className="p-3">{t('admin.marketplace.listings.created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((listing) => (
                  <tr key={listing.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <Link to={`/admin/marketplace/listings/${listing.id}`} className="flex items-center gap-3 font-medium hover:underline">
                        {listing.thumbnail ? (
                          <img src={resolvePublicUploadUrl(listing.thumbnail) ?? ''} alt="" className="size-10 rounded object-cover" />
                        ) : (
                          <span className="size-10 rounded bg-muted" />
                        )}
                        <span>
                          <span className="line-clamp-1">{listing.title}</span>
                          <span className="block text-xs font-normal text-muted-foreground">{formatPrice(listing.price)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link to={`/admin/marketplace/users/${listing.seller.id}`} className="hover:underline">
                        {listing.seller.name}
                      </Link>
                      {listing.sellerAccountStatus !== 'ACTIVE' ? (
                        <div className="mt-1">
                          <StatusPill tone={ACCOUNT_STATUS_TONE[listing.sellerAccountStatus]}>{t(`admin.marketplace.accountStatus.${listing.sellerAccountStatus}`)}</StatusPill>
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <StatusPill tone={MODERATION_STATUS_TONE[listing.moderationStatus]}>{t(`marketplace.moderation.${listing.moderationStatus}`)}</StatusPill>
                    </td>
                    <td className="p-3">{t(`marketplace.status.${listing.status}`)}</td>
                    <td className="p-3">{listing.openReportCount > 0 ? <StatusPill tone="bg-destructive/15 text-destructive">{listing.openReportCount}</StatusPill> : '—'}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(listing.createdAt)}</td>
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
