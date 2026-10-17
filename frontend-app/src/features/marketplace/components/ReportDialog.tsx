import { useMutation } from '@tanstack/react-query'
import { Flag } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { textareaClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api/client'

import { marketplaceApi } from '../api/marketplace-api'
import { REPORT_REASONS, type ReportReason } from '../types'
import { MarketplaceDialog } from './MarketplaceDialog'

type ReportDialogProps = {
  open: boolean
  target: { listingId: string } | { reportedUserId: string }
  onDismiss: () => void
}

export function ReportDialog({ open, target, onDismiss }: ReportDialogProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [description, setDescription] = useState('')
  const isListing = 'listingId' in target

  const reportMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.report({
        ...target,
        reason: reason as ReportReason,
        description: description.trim() || undefined,
      }),
  })

  const close = () => {
    setReason(null)
    setDescription('')
    reportMutation.reset()
    onDismiss()
  }

  const needsDetails = reason === 'OTHER' && !description.trim()

  return (
    <MarketplaceDialog
      open={open}
      title={isListing ? t('marketplace.report.titleListing') : t('marketplace.report.titleSeller')}
      description={t('marketplace.report.subtitle')}
      icon={<Flag className="size-5" aria-hidden />}
      tone="destructive"
      busy={reportMutation.isPending}
      onDismiss={close}
    >
      {reportMutation.isSuccess ? (
        <div className="space-y-4">
          <p className="text-sm" role="status">
            {t('marketplace.report.thanks')}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={close}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (reason && !needsDetails) reportMutation.mutate()
          }}
        >
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t('marketplace.report.reasonLabel')}</legend>
            {REPORT_REASONS.map((value) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="report-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                {t(`marketplace.report.reasons.${value}`)}
              </label>
            ))}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="report-description">
              {reason === 'OTHER' ? t('marketplace.report.detailsRequired') : t('marketplace.report.detailsOptional')}
            </Label>
            <textarea
              id="report-description"
              className={textareaClassName}
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('marketplace.report.detailsPlaceholder')}
            />
          </div>

          {reportMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {reportMutation.error instanceof ApiRequestError ? reportMutation.error.message : t('marketplace.report.error')}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close} disabled={reportMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={!reason || needsDetails || reportMutation.isPending}>
              {reportMutation.isPending ? t('common.loading') : t('marketplace.report.submit')}
            </Button>
          </div>
        </form>
      )}
    </MarketplaceDialog>
  )
}
