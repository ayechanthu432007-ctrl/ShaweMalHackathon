import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api/client'

import { marketplaceApi } from '../api/marketplace-api'
import { useTownships } from '../hooks/useMarketplaceData'
import { toDateInputValue } from '../lib/marketplace-format'
import type { MovingOutSaleInput, MyMovingOutSale } from '../types'
import { MarketplaceDialog, selectClassName, textareaClassName } from './MarketplaceDialog'

type MovingOutSaleDialogProps = {
  open: boolean
  sale: MyMovingOutSale | null
  onDismiss: () => void
}

const EMPTY: MovingOutSaleInput = {
  title: '',
  description: null,
  originCityId: '',
  destinationCityId: null,
  moveOutDate: null,
  isActive: true,
}

export function MovingOutSaleDialog({ open, sale, onDismiss }: MovingOutSaleDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const townships = useTownships().data ?? []
  const [values, setValues] = useState<MovingOutSaleInput>(EMPTY)

  useEffect(() => {
    if (!open) return
    setValues(
      sale
        ? {
            title: sale.title,
            description: sale.description,
            originCityId: sale.originCity.id,
            destinationCityId: sale.destinationCity?.id ?? null,
            moveOutDate: toDateInputValue(sale.moveOutDate) || null,
            isActive: sale.isActive,
          }
        : EMPTY,
    )
  }, [open, sale])

  const saveMutation = useMutation({
    mutationFn: () => (sale ? marketplaceApi.updateMovingOutSale(sale.id, values) : marketplaceApi.createMovingOutSale(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['marketplace'] })
      onDismiss()
    },
  })

  const canSave = values.title.trim().length >= 3 && Boolean(values.originCityId)

  return (
    <MarketplaceDialog
      open={open}
      title={sale ? t('marketplace.movingOut.editTitle') : t('marketplace.movingOut.createTitle')}
      description={t('marketplace.movingOut.dialogBody')}
      icon={<Truck className="size-5" aria-hidden />}
      busy={saveMutation.isPending}
      onDismiss={onDismiss}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSave) saveMutation.mutate()
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="sale-title">{t('marketplace.fields.title')}</Label>
          <Input
            id="sale-title"
            maxLength={120}
            value={values.title}
            placeholder={t('marketplace.movingOut.titlePlaceholder')}
            onChange={(event) => setValues({ ...values, title: event.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sale-origin">{t('marketplace.route.from')}</Label>
            <select id="sale-origin" className={selectClassName} value={values.originCityId} onChange={(event) => setValues({ ...values, originCityId: event.target.value })}>
              <option value="">{t('marketplace.sell.chooseTownship')}</option>
              {townships.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-destination">{t('marketplace.route.to')}</Label>
            <select
              id="sale-destination"
              className={selectClassName}
              value={values.destinationCityId ?? ''}
              onChange={(event) => setValues({ ...values, destinationCityId: event.target.value || null })}
            >
              <option value="">{t('marketplace.movingOut.notDecided')}</option>
              {townships.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sale-date">{t('marketplace.movingOut.moveOutDate')}</Label>
          <Input id="sale-date" type="date" value={values.moveOutDate ?? ''} onChange={(event) => setValues({ ...values, moveOutDate: event.target.value || null })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sale-description">{t('marketplace.fields.description')}</Label>
          <textarea
            id="sale-description"
            className={textareaClassName}
            maxLength={1000}
            value={values.description ?? ''}
            onChange={(event) => setValues({ ...values, description: event.target.value || null })}
          />
        </div>
        {sale ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={values.isActive} onChange={(event) => setValues({ ...values, isActive: event.target.checked })} />
            {t('marketplace.movingOut.activeToggle')}
          </label>
        ) : null}

        {saveMutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {saveMutation.error instanceof ApiRequestError ? saveMutation.error.message : t('marketplace.sell.saveError')}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onDismiss} disabled={saveMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!canSave || saveMutation.isPending}>
            {saveMutation.isPending ? t('common.loading') : t('marketplace.movingOut.save')}
          </Button>
        </div>
      </form>
    </MarketplaceDialog>
  )
}
