import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

import { marketplaceApi } from '../api/marketplace-api'
import { useTownships } from '../hooks/useMarketplaceData'
import { selectClassName } from './MarketplaceDialog'

type MovingRouteCardProps = {
  /** Guests can still try a route; the destination is passed up instead of being saved. */
  onGuestDestination: (cityId: string | null) => void
}

export function MovingRouteCard({ onGuestDestination }: MovingRouteCardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const townshipsQuery = useTownships()
  const townships = townshipsQuery.data ?? []

  const relocationQuery = useQuery({
    queryKey: ['marketplace', 'relocation'],
    enabled: isAuthenticated,
    queryFn: () => marketplaceApi.getRelocation(),
  })

  const saved = relocationQuery.data?.relocation ?? null
  const [originCityId, setOriginCityId] = useState('')
  const [destinationCityId, setDestinationCityId] = useState('')

  useEffect(() => {
    if (saved) {
      setOriginCityId(saved.originCity?.id ?? '')
      setDestinationCityId(saved.destinationCity.id)
    }
  }, [saved])

  const refreshHome = () => queryClient.invalidateQueries({ queryKey: ['marketplace', 'home'] })

  const saveMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.saveRelocation({
        originCityId: originCityId || null,
        destinationCityId,
        moveDate: null,
        status: 'PLANNING',
      }),
    onSuccess: async (data) => {
      queryClient.setQueryData(['marketplace', 'relocation'], data)
      await refreshHome()
    },
  })

  const clearMutation = useMutation({
    mutationFn: () => marketplaceApi.clearRelocation(),
    onSuccess: async () => {
      queryClient.setQueryData(['marketplace', 'relocation'], { relocation: null })
      setOriginCityId('')
      setDestinationCityId('')
      await refreshHome()
    },
  })

  const onSubmit = () => {
    if (!destinationCityId) return
    if (isAuthenticated) {
      saveMutation.mutate()
    } else {
      onGuestDestination(destinationCityId)
    }
  }

  const busy = saveMutation.isPending || clearMutation.isPending

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Truck className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('marketplace.route.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {saved
                ? t('marketplace.route.savedSummary', {
                    from: saved.originCity?.name ?? t('marketplace.route.anywhere'),
                    to: saved.destinationCity.name,
                  })
                : t('marketplace.route.subtitle')}
            </p>
          </div>
        </div>

        <form
          className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="route-origin">{t('marketplace.route.from')}</Label>
            <select
              id="route-origin"
              className={selectClassName}
              value={originCityId}
              onChange={(event) => setOriginCityId(event.target.value)}
            >
              <option value="">{t('marketplace.route.anywhere')}</option>
              {townships.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
          <ArrowRight className="mb-2 hidden size-5 text-muted-foreground sm:block" aria-hidden />
          <div className="space-y-1.5">
            <Label htmlFor="route-destination">{t('marketplace.route.to')}</Label>
            <select
              id="route-destination"
              className={selectClassName}
              value={destinationCityId}
              required
              onChange={(event) => setDestinationCityId(event.target.value)}
            >
              <option value="">{t('marketplace.route.chooseDestination')}</option>
              {townships.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!destinationCityId || busy}>
              {t('marketplace.route.showItems')}
            </Button>
            {saved ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => clearMutation.mutate()}>
                {t('common.clear')}
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
