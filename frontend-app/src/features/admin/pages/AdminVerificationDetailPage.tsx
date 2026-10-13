import { UserAvatar } from '@/components/common/UserAvatar'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ProtectedDocImage } from '@/components/uploads/ProtectedDocImage'
import { ApiRequestError } from '@/lib/api/client'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import { adminApi } from '../api/admin-api'
import type {
  AdminAgentRegistration,
  AdminDriverRegistration,
  VerificationAction,
  VerificationStatusValue,
} from '../types'

type DetailKind = 'agent' | 'driver'

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function DetailRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display =
    typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value === undefined || value === null || value === '' ? '—' : String(value)

  return (
    <p className="text-sm">
      <span className="font-medium">{label}: </span>
      {display}
    </p>
  )
}

function AgentDocsPreview({ registration }: { registration: AdminAgentRegistration }) {
  const { t } = useTranslation()
  const { profile } = registration

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar path={profile.profilePhotoPath} name={profile.name} className="size-16" />
        <p className="text-sm font-medium">{t('agent.profilePhoto')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ProtectedDocImage path={profile.nrcFrontPhotoPath} label={t('agent.nrcFrontPhotoPath')} />
        <ProtectedDocImage path={profile.nrcBackPhotoPath} label={t('agent.nrcBackPhotoPath')} />
      </div>
    </div>
  )
}

function DriverDocsPreview({ registration }: { registration: AdminDriverRegistration }) {
  const { t } = useTranslation()
  const { profile } = registration
  const profileSrc = resolvePublicUploadUrl(profile.profilePhotoPath)

  return (
    <div className="space-y-3">
      {profileSrc ? (
        <img src={profileSrc} alt="" className="size-20 rounded-full border border-input object-cover" />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <ProtectedDocImage path={profile.nrcFrontPhotoPath} label={t('driver.nrcFrontPhotoPath')} />
        <ProtectedDocImage path={profile.nrcBackPhotoPath} label={t('driver.nrcBackPhotoPath')} />
        <ProtectedDocImage path={profile.drivingLicensePhotoPath} label={t('driver.drivingLicensePhotoPath')} />
        <ProtectedDocImage path={profile.vehiclePhotoPath} label={t('driver.vehiclePhotoPath')} />
        <ProtectedDocImage path={profile.wheelTaxPhotoPath} label={t('driver.wheelTaxPhotoPath')} />
      </div>
    </div>
  )
}

export function AdminVerificationDetailPage({ kind }: { kind: DetailKind }) {
  const { t } = useTranslation()
  const { userId = '' } = useParams()
  const queryClient = useQueryClient()
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const agentQuery = useQuery({
    queryKey: ['admin', 'agent', 'registration', userId],
    enabled: kind === 'agent' && Boolean(userId),
    queryFn: () => adminApi.getAgentRegistration(userId),
  })
  const driverQuery = useQuery({
    queryKey: ['admin', 'driver', 'registration', userId],
    enabled: kind === 'driver' && Boolean(userId),
    queryFn: () => adminApi.getDriverRegistration(userId),
  })
  const registrationQuery = kind === 'agent' ? agentQuery : driverQuery

  const mutation = useMutation({
    mutationFn: async (status: VerificationAction) => {
      if (kind === 'agent') {
        return adminApi.updateAgentVerification(userId, status, rejectionReason)
      }
      return adminApi.updateDriverVerification(userId, status, rejectionReason)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', kind] })
    },
  })

  const queuePath = kind === 'agent' ? '/admin/verifications/agents' : '/admin/verifications/drivers'
  const titleKey = kind === 'agent' ? 'admin.verifications.agentDetailTitle' : 'admin.verifications.driverDetailTitle'
  const status: VerificationStatusValue | undefined =
    kind === 'agent'
      ? agentQuery.data?.profile.verificationStatus
      : driverQuery.data?.profile.verificationStatus

  const runAction = async (statusAction: VerificationAction) => {
    setActionError(null)
    setActionSuccess(null)

    const confirmed = window.confirm(
      statusAction === 'reject'
        ? t('admin.verifications.confirmReject')
        : statusAction === 'approve'
          ? t('admin.verifications.confirmApprove')
          : t('admin.verifications.confirmPending'),
    )
    if (!confirmed) return

    try {
      const result = await mutation.mutateAsync(statusAction)
      const nextStatus =
        kind === 'agent' ? result.user.agentVerificationStatus : result.user.driverVerificationStatus
      setActionSuccess(t('admin.verifications.success', { name: result.user.name, status: nextStatus ?? '' }))
      setRejectionReason('')
    } catch (error) {
      setActionError(error instanceof ApiRequestError ? error.message : t('admin.verifications.actionFailed'))
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <BackLink to={queuePath} label={t('admin.verifications.backToQueue')} />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{t(titleKey)}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.verifications.detailSubtitle')}</p>
      </div>

      {registrationQuery.isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('common.loading')}
        </p>
      ) : null}

      {registrationQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.verifications.loadDocsFailed')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              {registrationQuery.error instanceof ApiRequestError
                ? registrationQuery.error.message
                : t('admin.verifications.loadDocsFailed')}
            </p>
            <Button type="button" onClick={() => void registrationQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {agentQuery.data && kind === 'agent' ? (
        <AgentDetail
          registration={agentQuery.data}
          rejectionReason={rejectionReason}
          onRejectionReasonChange={setRejectionReason}
          actionError={actionError}
          actionSuccess={actionSuccess}
          isSubmitting={mutation.isPending}
          onApprove={() => void runAction('approve')}
          onReject={() => void runAction('reject')}
          onResetPending={status && status !== 'PENDING' ? () => void runAction('pending') : undefined}
        />
      ) : null}

      {driverQuery.data && kind === 'driver' ? (
        <DriverDetail
          registration={driverQuery.data}
          rejectionReason={rejectionReason}
          onRejectionReasonChange={setRejectionReason}
          actionError={actionError}
          actionSuccess={actionSuccess}
          isSubmitting={mutation.isPending}
          onApprove={() => void runAction('approve')}
          onReject={() => void runAction('reject')}
          onResetPending={status && status !== 'PENDING' ? () => void runAction('pending') : undefined}
        />
      ) : null}
    </section>
  )
}

function DecisionPanel({
  rejectionReason,
  onRejectionReasonChange,
  actionError,
  actionSuccess,
  isSubmitting,
  onApprove,
  onReject,
  onResetPending,
}: {
  rejectionReason: string
  onRejectionReasonChange: (value: string) => void
  actionError: string | null
  actionSuccess: string | null
  isSubmitting: boolean
  onApprove: () => void
  onReject: () => void
  onResetPending?: () => void
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.verifications.decisionTitle')}</CardTitle>
        <CardDescription>{t('admin.verifications.decisionDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rejection-reason">{t('admin.verifications.rejectionReason')}</Label>
          <textarea
            id="rejection-reason"
            className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            maxLength={500}
            value={rejectionReason}
            onChange={(event) => onRejectionReasonChange(event.target.value)}
            placeholder={t('admin.verifications.rejectionReasonPlaceholder')}
          />
        </div>
        {actionError ? (
          <p className="text-sm text-destructive" role="alert">
            {actionError}
          </p>
        ) : null}
        {actionSuccess ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {actionSuccess}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isSubmitting} onClick={onApprove}>
            {t('admin.verifications.statusApprove')}
          </Button>
          <Button type="button" variant="destructive" disabled={isSubmitting} onClick={onReject}>
            {t('admin.verifications.statusReject')}
          </Button>
          {onResetPending ? (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onResetPending}>
              {t('admin.verifications.statusPending')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function AgentDetail({
  registration,
  ...decision
}: {
  registration: AdminAgentRegistration
} & Omit<Parameters<typeof DecisionPanel>[0], never>) {
  const { t } = useTranslation()
  const { user, profile } = registration

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {user.name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{profile.verificationStatus}</span>
          </CardTitle>
          <CardDescription>
            {t('admin.verifications.submittedAt')}: {formatDate(profile.submittedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <DetailRow label={t('auth.email')} value={user.email} />
          <DetailRow label={t('auth.phone')} value={user.phone} />
          <DetailRow label={t('agent.nrc')} value={profile.nrc} />
          <DetailRow label={t('auth.email')} value={profile.email} />
          <DetailRow label={t('auth.phone')} value={profile.phone} />
          <DetailRow label={t('agent.telegram')} value={profile.telegram} />
          <DetailRow label={t('agent.viber')} value={profile.viber} />
          <DetailRow label={t('agent.address1')} value={profile.address1} />
          <DetailRow label={t('agent.address2')} value={profile.address2} />
          <DetailRow label={t('agent.city')} value={profile.city?.name} />
          <DetailRow label={t('agent.state')} value={profile.state?.name} />
          <DetailRow label={t('agent.serviceRegion')} value={profile.serviceRegion?.name} />
          <DetailRow label={t('agent.hasRentingExperience')} value={profile.hasRentingExperience} />
          <DetailRow label={t('admin.verifications.rejectionReason')} value={profile.rejectionReason} />
          <DetailRow label={t('admin.verifications.reviewedAt')} value={formatDate(profile.reviewedAt)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.verifications.documents')}</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentDocsPreview registration={registration} />
        </CardContent>
      </Card>
      <DecisionPanel {...decision} />
    </>
  )
}

function DriverDetail({
  registration,
  ...decision
}: {
  registration: AdminDriverRegistration
} & Omit<Parameters<typeof DecisionPanel>[0], never>) {
  const { t } = useTranslation()
  const { user, profile } = registration

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {user.name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{profile.verificationStatus}</span>
          </CardTitle>
          <CardDescription>
            {t('admin.verifications.submittedAt')}: {formatDate(profile.submittedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <DetailRow label={t('auth.email')} value={user.email} />
          <DetailRow label={t('auth.phone')} value={user.phone} />
          <DetailRow label={t('driver.nrc')} value={profile.nrc} />
          <DetailRow label={t('auth.phone')} value={profile.phone} />
          <DetailRow label={t('driver.companyName')} value={profile.companyName} />
          <DetailRow label={t('driver.currentAddress')} value={profile.currentAddress} />
          <DetailRow label={t('moving.vehicleType')} value={profile.vehicleType?.name} />
          <DetailRow label={t('driver.vehicleLicensePlateNumber')} value={profile.vehicleLicensePlateNumber} />
          <DetailRow label={t('admin.verifications.rejectionReason')} value={profile.rejectionReason} />
          <DetailRow label={t('admin.verifications.reviewedAt')} value={formatDate(profile.reviewedAt)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.verifications.documents')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DriverDocsPreview registration={registration} />
        </CardContent>
      </Card>
      <DecisionPanel {...decision} />
    </>
  )
}
