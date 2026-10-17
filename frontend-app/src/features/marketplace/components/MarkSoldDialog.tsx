import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackageCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/common/PageStates'
import { Button } from '@/components/ui/button'
import { ApiRequestError } from '@/lib/api/client'

import { marketplaceApi } from '../api/marketplace-api'
import { formatDate } from '../lib/marketplace-format'
import type { MyListing } from '../types'
import { MarketplaceDialog } from './MarketplaceDialog'

const NO_BUYER = ''

export function MarkSoldDialog({ listing, onDismiss }: { listing: MyListing | null; onDismiss: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [buyerId, setBuyerId] = useState(NO_BUYER)

  const buyersQuery = useQuery({
    queryKey: ['marketplace', 'interested-buyers', listing?.id],
    enabled: Boolean(listing),
    queryFn: () => marketplaceApi.interestedBuyers(listing?.id as string),
  })

  const soldMutation = useMutation({
    mutationFn: () => marketplaceApi.updateListingStatus(listing?.id as string, { status: 'SOLD', buyerId: buyerId || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['marketplace'] })
      setBuyerId(NO_BUYER)
      onDismiss()
    },
  })

  const buyers = buyersQuery.data?.items ?? []

  return (
    <MarketplaceDialog
      open={Boolean(listing)}
      title={t('marketplace.markSold.title')}
      description={t('marketplace.markSold.body', { title: listing?.title ?? '' })}
      icon={<PackageCheck className="size-5" aria-hidden />}
      busy={soldMutation.isPending}
      onDismiss={onDismiss}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          soldMutation.mutate()
        }}
      >
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">{t('marketplace.markSold.whoBought')}</legend>
          {buyersQuery.isLoading ? <LoadingState /> : null}
          {buyers.map((buyer) => (
            <label key={buyer.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input type="radio" name="buyer" value={buyer.id} checked={buyerId === buyer.id} onChange={() => setBuyerId(buyer.id)} />
              <span className="flex-1">{buyer.name}</span>
              <span className="text-xs text-muted-foreground">{t('marketplace.markSold.contactedOn', { date: formatDate(buyer.contactedAt) })}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name="buyer" value={NO_BUYER} checked={buyerId === NO_BUYER} onChange={() => setBuyerId(NO_BUYER)} />
            {t('marketplace.markSold.someoneElse')}
          </label>
          <p className="text-xs text-muted-foreground">{t('marketplace.markSold.reviewHint')}</p>
        </fieldset>

        {soldMutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {soldMutation.error instanceof ApiRequestError ? soldMutation.error.message : t('marketplace.sell.saveError')}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onDismiss} disabled={soldMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={soldMutation.isPending}>
            {soldMutation.isPending ? t('common.loading') : t('marketplace.actions.markSold')}
          </Button>
        </div>
      </form>
    </MarketplaceDialog>
  )
}
