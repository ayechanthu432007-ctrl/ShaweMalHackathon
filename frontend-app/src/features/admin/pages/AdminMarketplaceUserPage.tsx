import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CircleX } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { textareaClassName } from '@/components/ui/field-styles'
import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { BackButton } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SellerBadges } from '@/features/marketplace/components/SellerBadges'
import { formatDate, formatPrice } from '@/features/marketplace/lib/marketplace-format'
import type { AccountStatus } from '@/features/marketplace/types'
import { ApiRequestError } from '@/lib/api/client'

import { adminMarketplaceApi, type AdminMarketplaceUser } from '../api/admin-marketplace-api'
import { AdminMarketplaceNav, StatusPill } from '../components/AdminMarketplaceNav'
import { AdminReportCard } from '../components/AdminReportCard'
import { ACCOUNT_STATUS_TONE, MODERATION_STATUS_TONE } from '../lib/marketplace-tones'

function VerificationRow({
  label,
  description,
  since,
  disabled,
  pending,
  onToggle,
}: {
  label: string
  description: string
  since: string | null
  disabled?: boolean
  pending: boolean
  onToggle: (value: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        {since ? <p className="text-xs text-muted-foreground">{t('admin.marketplace.user.since', { date: formatDate(since) })}</p> : null}
      </div>
      <Button type="button" size="sm" variant={since ? 'outline' : 'default'} disabled={pending || disabled} onClick={() => onToggle(!since)}>
        {since ? t('admin.marketplace.user.revoke') : t('admin.marketplace.user.grant')}
      </Button>
    </div>
  )
}

function TrustedChecklist({ user }: { user: AdminMarketplaceUser }) {
  const { t } = useTranslation()
  const evaluation = user.trustedSellerEvaluation
  const items = [
    { key: 'identityVerified', ok: evaluation.checks.identityVerified, detail: '' },
    {
      key: 'completedTransactions',
      ok: evaluation.checks.completedTransactions,
      detail: `${evaluation.soldListings}/${evaluation.criteria.minSoldListings}`,
    },
    {
      key: 'goodReviews',
      ok: evaluation.checks.goodReviews,
      detail: `${evaluation.rating.average?.toFixed(1) ?? '—'}★ · ${evaluation.rating.count}/${evaluation.criteria.minReviews}`,
    },
    { key: 'noSeriousReports', ok: evaluation.checks.noSeriousReports, detail: String(evaluation.upheldReports) },
  ] as const

  return (
    <ul className="space-y-1 text-sm">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2">
          {item.ok ? <CircleCheck className="size-4 text-emerald-600" aria-hidden /> : <CircleX className="size-4 text-destructive" aria-hidden />}
          <span className="flex-1">{t(`admin.marketplace.user.trustedChecks.${item.key}`, evaluation.criteria)}</span>
          {item.detail ? <span className="text-xs text-muted-foreground">{item.detail}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export function AdminMarketplaceUserPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { user: currentAdmin } = useAuth()
  const [reason, setReason] = useState('')

  const userQuery = useQuery({
    queryKey: ['admin', 'marketplace', 'user', id],
    queryFn: () => adminMarketplaceApi.getUser(id),
    enabled: Boolean(id),
  })

  const onUpdated = async (data: { user: AdminMarketplaceUser }) => {
    queryClient.setQueryData(['admin', 'marketplace', 'user', id], data)
    await queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace'] })
  }

  const verificationMutation = useMutation({
    mutationFn: (input: { phoneVerified?: boolean; identityVerified?: boolean; trustedSeller?: boolean }) =>
      adminMarketplaceApi.updateVerification(id, input),
    onSuccess: onUpdated,
  })

  const statusMutation = useMutation({
    mutationFn: (accountStatus: AccountStatus) => adminMarketplaceApi.updateAccountStatus(id, { accountStatus, reason: reason.trim() || undefined }),
    onSuccess: async (data) => {
      setReason('')
      await onUpdated(data)
    },
  })

  if (userQuery.isLoading) return <LoadingState />
  const user = userQuery.data?.user
  if (userQuery.isError || !user) return <h1 className="text-base font-semibold text-destructive">{t('admin.marketplace.loadError')}</h1>

  const isSelf = currentAdmin?.id === user.id
  const actionError = verificationMutation.error ?? statusMutation.error

  return (
    <section className="space-y-6">
      <AdminMarketplaceNav />
      <BackButton fallback="/admin/marketplace/users" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {user.email} · {user.phone} · {t('admin.marketplace.users.joined')} {formatDate(user.createdAt)}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusPill tone={ACCOUNT_STATUS_TONE[user.accountStatus]}>{t(`admin.marketplace.accountStatus.${user.accountStatus}`)}</StatusPill>
            <SellerBadges badges={user.badges} />
          </div>
        </div>
        {user.listingHistory.some((listing) => listing.moderationStatus === 'APPROVED') ? (
          <Button asChild variant="outline">
            <Link to={`/marketplace/sellers/${user.id}`} target="_blank">
              {t('admin.marketplace.user.viewProfile')}
            </Link>
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          {actionError instanceof ApiRequestError ? actionError.message : t('admin.marketplace.actionError')}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t('admin.marketplace.user.verificationTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <VerificationRow
              label={t('marketplace.badges.PHONE_VERIFIED.label')}
              description={t('admin.marketplace.user.phoneHint')}
              since={user.phoneVerifiedAt}
              pending={verificationMutation.isPending}
              onToggle={(value) => verificationMutation.mutate({ phoneVerified: value })}
            />
            <VerificationRow
              label={t('marketplace.badges.IDENTITY_VERIFIED.label')}
              description={t('marketplace.badges.IDENTITY_VERIFIED.description')}
              since={user.identityVerifiedAt}
              pending={verificationMutation.isPending}
              onToggle={(value) => verificationMutation.mutate({ identityVerified: value })}
            />
            <VerificationRow
              label={t('marketplace.badges.TRUSTED_SELLER.label')}
              description={t('marketplace.badges.TRUSTED_SELLER.description')}
              since={user.trustedSellerAt}
              disabled={!user.trustedSellerAt && !user.trustedSellerEvaluation.eligible}
              pending={verificationMutation.isPending}
              onToggle={(value) => verificationMutation.mutate({ trustedSeller: value })}
            />
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-2 text-sm font-medium">{t('admin.marketplace.user.trustedCriteria')}</p>
              <TrustedChecklist user={user} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t('admin.marketplace.user.accountTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('admin.marketplace.user.accountHint')}</p>
            <textarea
              className={textareaClassName}
              aria-label={t('admin.marketplace.user.reason')}
              placeholder={t('admin.marketplace.user.reason')}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {user.accountStatus !== 'ACTIVE' ? (
                <Button type="button" size="sm" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate('ACTIVE')}>
                  {t('admin.marketplace.user.reactivate')}
                </Button>
              ) : null}
              {user.accountStatus !== 'SUSPENDED' ? (
                <Button type="button" size="sm" variant="outline" disabled={statusMutation.isPending || isSelf} onClick={() => statusMutation.mutate('SUSPENDED')}>
                  {t('admin.marketplace.user.suspend')}
                </Button>
              ) : null}
              {user.accountStatus !== 'BANNED' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={statusMutation.isPending || isSelf}
                  onClick={() => {
                    if (window.confirm(t('admin.marketplace.user.banConfirm', { name: user.name }))) statusMutation.mutate('BANNED')
                  }}
                >
                  {t('admin.marketplace.user.ban')}
                </Button>
              ) : null}
            </div>
            {user.sellerContact ? (
              <dl className="grid gap-1 border-t pt-3 text-xs text-muted-foreground">
                <dt className="font-medium text-foreground">{t('admin.marketplace.user.sellerContact')}</dt>
                <dd>
                  {t('marketplace.contact.phone')}: {user.sellerContact.phone ?? '—'}
                </dd>
                <dd>Telegram: {user.sellerContact.telegramUsername ?? '—'}</dd>
                <dd>Viber: {user.sellerContact.viberNumber ?? '—'}</dd>
              </dl>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('admin.marketplace.user.listingHistory', { count: user.listingHistory.length })}</h2>
        {user.listingHistory.length === 0 ? <p className="text-sm text-muted-foreground">{t('marketplace.seller.noListings')}</p> : null}
        <ul className="divide-y rounded-xl border">
          {user.listingHistory.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <Link to={`/admin/marketplace/listings/${listing.id}`} className="font-medium hover:underline">
                {listing.title}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatPrice(listing.price)}</span>
                <StatusPill>{t(`marketplace.status.${listing.status}`)}</StatusPill>
                <StatusPill tone={MODERATION_STATUS_TONE[listing.moderationStatus]}>{t(`marketplace.moderation.${listing.moderationStatus}`)}</StatusPill>
                <span>{formatDate(listing.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('admin.marketplace.user.reportsReceived', { count: user.reportsReceived.length })}</h2>
        {user.reportsReceived.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.marketplace.reports.empty')}</p> : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {user.reportsReceived.map((report) => (
            <AdminReportCard key={report.id} report={report} />
          ))}
        </div>
      </section>
    </section>
  )
}
