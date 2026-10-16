import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiRequestError } from '@/lib/api/client'

import { marketplaceApi } from '../api/marketplace-api'
import { formatDate } from '../lib/marketplace-format'
import { textareaClassName } from './MarketplaceDialog'

/** Lets a signed-in buyer send the seller a written question and shows the seller's reply. */
export function AskSellerCard({ listingId }: { listingId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const [message, setMessage] = useState('')

  const mineQuery = useQuery({
    queryKey: ['marketplace', 'my-inquiry', listingId],
    enabled: isAuthenticated,
    queryFn: () => marketplaceApi.myInquiry(listingId),
  })

  const sendMutation = useMutation({
    mutationFn: () => marketplaceApi.sendInquiry(listingId, message.trim()),
    onSuccess: async () => {
      setMessage('')
      await queryClient.invalidateQueries({ queryKey: ['marketplace', 'my-inquiry', listingId] })
    },
  })

  const existing = mineQuery.data?.inquiry

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5 text-primary" aria-hidden />
          {t('marketplace.inquiry.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {existing ? (
          <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
            <p>
              <span className="font-medium">{t('marketplace.inquiry.you')}:</span> {existing.message}
            </p>
            {existing.sellerReply ? (
              <p>
                <span className="font-medium">{t('marketplace.inquiry.seller')}:</span> {existing.sellerReply}
                <span className="ml-1 text-xs text-muted-foreground">({formatDate(existing.repliedAt)})</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('marketplace.inquiry.awaiting')}</p>
            )}
          </div>
        ) : null}
        {!isAuthenticated ? (
          <Button type="button" variant="outline" onClick={() => navigate('/sign-in', { state: { from: location.pathname } })}>
            {t('marketplace.inquiry.signIn')}
          </Button>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (message.trim().length >= 2) sendMutation.mutate()
            }}
          >
            <textarea
              className={textareaClassName}
              maxLength={1000}
              aria-label={t('marketplace.inquiry.label')}
              placeholder={t('marketplace.inquiry.placeholder')}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            {sendMutation.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {sendMutation.error instanceof ApiRequestError ? sendMutation.error.message : t('marketplace.inquiry.error')}
              </p>
            ) : null}
            {sendMutation.isSuccess ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
                {t('marketplace.inquiry.sent')}
              </p>
            ) : null}
            <Button type="submit" disabled={message.trim().length < 2 || sendMutation.isPending}>
              {sendMutation.isPending ? t('common.loading') : existing ? t('marketplace.inquiry.update') : t('marketplace.inquiry.send')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
