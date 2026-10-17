import { useEffect, useId } from 'react'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServiceRatingForm } from '@/features/reviews/components/ServiceRatingForm'

import { assignedDriverName } from '../lib/moving-status'
import type { MovingRequest } from '../types'

export function MovingStatusRateDriverDialog({
  open,
  request,
  onDismiss,
}: {
  open: boolean
  request: MovingRequest
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const driverName = assignedDriverName(request)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onDismiss])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 [&>[role=dialog]]:my-auto">
      <div aria-hidden="true" className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onDismiss} />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-md overflow-hidden shadow-overlay"
      >
        <div className="h-1 bg-primary" />
        <CardHeader className="space-y-4 pb-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Star className="size-6" aria-hidden="true" />
          </div>
          <CardTitle>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              {t('reviews.rateDriver', { name: driverName?.trim() || t('reviews.driverFallback') })}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div id={descriptionId}>
            <ServiceRatingForm
              source={{ movingRequestId: request.id }}
              targetKind="driver"
              targetName={driverName}
              existing={request.myReview}
              hideTitle
              onSubmitted={onDismiss}
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onDismiss}>
              {t('common.close')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
