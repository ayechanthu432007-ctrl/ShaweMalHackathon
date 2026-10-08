import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { selectClassName, textareaClassName } from '@/features/marketplace/components/MarketplaceDialog'
import { SellerBadges } from '@/features/marketplace/components/SellerBadges'
import { useMarketplaceCategories } from '@/features/marketplace/hooks/useMarketplaceData'
import { categoryLabel, formatDate, formatPrice } from '@/features/marketplace/lib/marketplace-format'
import { ApiRequestError } from '@/lib/api/client'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { adminMarketplaceApi, type ModerationAction } from '../api/admin-marketplace-api'
import { AdminMarketplaceNav, StatusPill } from '../components/AdminMarketplaceNav'
import { AdminReportCard } from '../components/AdminReportCard'
import { ACCOUNT_STATUS_TONE, MODERATION_STATUS_TONE } from '../lib/marketplace-tones'

const ACTIONS_BY_STATUS: Record<string, ModerationAction[]> = {
  PENDING: ['approve', 'reject', 'remove'],
  APPROVED: ['reject', 'remove'],
  REJECTED: ['approve', 'remove'],
  REMOVED: ['restore'],
}

export function AdminMarketplaceListingPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const categories = useMarketplaceCategories().data ?? []
  const [note, setNote] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')

  const listingQuery = useQuery({
    queryKey: ['admin', 'marketplace', 'listing', id],
    queryFn: () => adminMarketplaceApi.getListing(id),
    enabled: Boolean(id),
  })

  const listing = listingQuery.data?.listing

  useEffect(() => {
    if (listing) {
      setCategoryId(listing.category.id)
      setSubcategoryId(listing.subcategory?.id ?? '')
    }
  }, [listing])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace'] })

  const moderateMutation = useMutation({
    mutationFn: (action: ModerationAction) => adminMarketplaceApi.moderateListing(id, { action, note: note.trim() || undefined }),
    onSuccess: async () => {
      setNote('')
      await invalidate()
    },
  })

  const categoryMutation = useMutation({
    mutationFn: () => adminMarketplaceApi.updateListingCategory(id, { categoryId, subcategoryId: subcategoryId || null }),
    onSuccess: invalidate,
  })

  if (listingQuery.isLoading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  if (listingQuery.isError || !listing) return <p className="text-sm text-destructive">{t('admin.marketplace.loadError')}</p>

  const selectedCategory = categories.find((category) => category.id === categoryId)
  const needsNote = (action: ModerationAction) => action === 'reject' || action === 'remove'

  return (
    <section className="space-y-6">
      <AdminMarketplaceNav />
      <BackButton fallback="/admin/marketplace/listings" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={MODERATION_STATUS_TONE[listing.moderationStatus]}>{t(`marketplace.moderation.${listing.moderationStatus}`)}</StatusPill>
            <StatusPill>{t(`marketplace.status.${listing.status}`)}</StatusPill>
          </div>
          {listing.moderationNote ? <p className="text-sm text-muted-foreground">{listing.moderationNote}</p> : null}
        </div>
        {listing.moderationStatus === 'APPROVED' ? (
          <Button asChild variant="outline">
            <Link to={`/marketplace/items/${listing.id}`} target="_blank">
              {t('admin.marketplace.listing.viewPublic')}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {listing.images.map((image) => (
              <li key={image.id}>
                <a href={resolvePublicUploadUrl(image.imagePath) ?? '#'} target="_blank" rel="noreferrer">
                  <img src={resolvePublicUploadUrl(image.thumbnailPath) ?? ''} alt="" className="aspect-square w-full rounded-md object-cover" />
                </a>
              </li>
            ))}
          </ul>
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <p className="text-2xl font-semibold text-primary">{formatPrice(listing.price)}</p>
              <p>
                {categoryLabel(listing.category, i18n.language)}
                {listing.subcategory ? ` › ${categoryLabel(listing.subcategory, i18n.language)}` : ''} · {t(`marketplace.condition.${listing.condition}`)}
              </p>
              <p>
                {[listing.locationDetail, listing.city.name, listing.state.name].filter(Boolean).join(', ')} · {t(`marketplace.pickup.${listing.pickupMethod}`)}
              </p>
              <p className="whitespace-pre-line pt-2">{listing.description}</p>
              <p className="pt-2 text-xs text-muted-foreground">
                {t('admin.marketplace.listing.policyAccepted', { date: formatDate(listing.policyAcceptedAt) })}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t('admin.marketplace.listing.reportsTitle', { count: listing.reports.length })}</h2>
            {listing.reports.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.marketplace.reports.empty')}</p> : null}
            {listing.reports.map((report) => (
              <AdminReportCard key={report.id} report={report} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t('admin.marketplace.listing.moderationTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className={textareaClassName}
                aria-label={t('admin.marketplace.listing.note')}
                placeholder={t('admin.marketplace.listing.note')}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {(ACTIONS_BY_STATUS[listing.moderationStatus] ?? []).map((action) => (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={action === 'remove' || action === 'reject' ? 'destructive' : 'default'}
                    disabled={moderateMutation.isPending || (needsNote(action) && !note.trim())}
                    title={needsNote(action) && !note.trim() ? t('admin.marketplace.listing.noteRequired') : undefined}
                    onClick={() => moderateMutation.mutate(action)}
                  >
                    {t(`admin.marketplace.listing.actions.${action}`)}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('admin.marketplace.listing.noteRequired')}</p>
              {moderateMutation.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  {moderateMutation.error instanceof ApiRequestError ? moderateMutation.error.message : t('admin.marketplace.actionError')}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t('admin.marketplace.listing.categoryTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                aria-label={t('marketplace.fields.category')}
                className={selectClassName}
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value)
                  setSubcategoryId('')
                }}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryLabel(category, i18n.language)}
                  </option>
                ))}
              </select>
              <select
                aria-label={t('marketplace.fields.subcategory')}
                className={selectClassName}
                value={subcategoryId}
                disabled={!selectedCategory || selectedCategory.children.length === 0}
                onChange={(event) => setSubcategoryId(event.target.value)}
              >
                <option value="">{t('marketplace.sell.chooseSubcategory')}</option>
                {selectedCategory?.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {categoryLabel(child, i18n.language)}
                  </option>
                ))}
              </select>
              {categoryMutation.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  {categoryMutation.error instanceof ApiRequestError ? categoryMutation.error.message : t('admin.marketplace.actionError')}
                </p>
              ) : null}
              {categoryMutation.isSuccess ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{t('admin.marketplace.saved')}</p> : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  categoryMutation.isPending ||
                  (categoryId === listing.category.id && subcategoryId === (listing.subcategory?.id ?? ''))
                }
                onClick={() => categoryMutation.mutate()}
              >
                {t('admin.marketplace.listing.saveCategory')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t('admin.marketplace.listing.sellerTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{listing.seller.name}</p>
              <p className="text-muted-foreground">{listing.sellerAccount.email}</p>
              <p className="text-muted-foreground">{listing.sellerAccount.phone}</p>
              <StatusPill tone={ACCOUNT_STATUS_TONE[listing.sellerAccount.accountStatus]}>
                {t(`admin.marketplace.accountStatus.${listing.sellerAccount.accountStatus}`)}
              </StatusPill>
              <SellerBadges badges={listing.seller.badges} />
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link to={`/admin/marketplace/users/${listing.seller.id}`}>{t('admin.marketplace.listing.manageSeller')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
