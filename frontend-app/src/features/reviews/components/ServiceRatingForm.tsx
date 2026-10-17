import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { textareaClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

import { reviewsApi } from '../api/reviews-api'
import type { MyReview } from '../types'
import { StarRating } from './StarRating'

export function ServiceRatingForm({
  source,
  targetKind,
  targetName,
  existing,
  hideTitle = false,
  className,
  onSubmitted,
}: {
  source: { bookingId: string } | { movingRequestId: string }
  targetKind: 'agent' | 'driver'
  targetName?: string | null
  existing?: MyReview | null
  hideTitle?: boolean
  className?: string
  onSubmitted?: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const ratingLabelId = useId()
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRating(existing?.rating ?? 0)
    setComment(existing?.comment ?? '')
  }, [existing?.id, existing?.rating, existing?.comment])

  const mutation = useMutation({
    mutationFn: reviewsApi.create,
    onSuccess: async () => {
      setError(null)
      setMessage(existing ? t('reviews.updateSuccess') : t('reviews.submitSuccess'))
      onSubmitted?.()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['moving-request'] }),
        queryClient.invalidateQueries({ queryKey: ['moving-requests-mine'] }),
        queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-history'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
      ])
    },
    onError: (err) => {
      setMessage(null)
      setError(err instanceof ApiRequestError ? err.message : t('reviews.submitFailed'))
    },
  })

  const title =
    targetKind === 'driver'
      ? t('reviews.rateDriver', { name: targetName?.trim() || t('reviews.driverFallback') })
      : t('reviews.rateAgent', { name: targetName?.trim() || t('reviews.agentFallback') })

  return (
    <form
      className={cn('space-y-3', className)}
      onSubmit={(event) => {
        event.preventDefault()
        setMessage(null)
        setError(null)
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          setError(t('reviews.ratingRequired'))
          return
        }

        void mutation.mutateAsync({
          ...source,
          rating,
          comment: comment.trim() || undefined,
        })
      }}
      noValidate
    >
      <div>
        {hideTitle ? null : <p className="text-sm font-medium">{title}</p>}
        <p className="text-xs text-muted-foreground">{t('reviews.helper')}</p>
      </div>
      <div className="space-y-1.5">
        <Label id={ratingLabelId}>{t('reviews.rating')}</Label>
        <StarRating value={rating} onChange={setRating} labelledBy={ratingLabelId} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${ratingLabelId}-comment`}>{t('reviews.comment')}</Label>
        <textarea
          id={`${ratingLabelId}-comment`}
          value={comment}
          maxLength={1000}
          rows={3}
          onChange={(event) => setComment(event.target.value)}
          className={textareaClassName}
          placeholder={t('reviews.commentPlaceholder')}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-primary">{message}</p> : null}
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        {mutation.isPending ? t('common.loading') : existing ? t('reviews.update') : t('reviews.submit')}
      </Button>
    </form>
  )
}
