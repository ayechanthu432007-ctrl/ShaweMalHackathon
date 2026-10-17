import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MasterDataItem } from '@/features/master-data/types'

export type HouseFilterValues = {
  city: string
  type: string
  minBudget: string
  maxBudget: string
}

type HouseFilterFormProps = {
  defaultValues: HouseFilterValues
  cities: MasterDataItem[]
  propertyTypes: MasterDataItem[]
  isLoadingOptions?: boolean
  onSubmit: (values: HouseFilterValues) => void
}

export function HouseFilterForm({
  defaultValues,
  cities,
  propertyTypes,
  isLoadingOptions = false,
  onSubmit,
}: HouseFilterFormProps) {
  const { t } = useTranslation()
  const { register, handleSubmit, reset } = useForm<HouseFilterValues>({
    values: defaultValues,
  })

  return (
    <form
      className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      onSubmit={handleSubmit((values) => onSubmit(values))}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="city">{t('houses.filters.city')}</Label>
        <select
          id="city"
          className={selectClassName}
          disabled={isLoadingOptions}
          {...register('city')}
        >
          <option value="">{t('houses.filters.any')}</option>
          {cities.map((city) => (
            <option key={city.id} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">{t('houses.filters.type')}</Label>
        <select
          id="type"
          className={selectClassName}
          disabled={isLoadingOptions}
          {...register('type')}
        >
          <option value="">{t('houses.filters.any')}</option>
          {propertyTypes.map((type) => (
            <option key={type.id} value={type.name}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="minBudget">{t('houses.filters.minBudget')}</Label>
        <Input id="minBudget" type="number" min={0} step="1" {...register('minBudget')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxBudget">{t('houses.filters.maxBudget')}</Label>
        <Input id="maxBudget" type="number" min={0} step="1" {...register('maxBudget')} />
      </div>

      <div className="flex items-end gap-2">
        <Button type="submit" className="flex-1">
          {t('houses.filters.apply')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const cleared = { city: '', type: '', minBudget: '', maxBudget: '' }
            reset(cleared)
            onSubmit(cleared)
          }}
        >
          {t('common.clear')}
        </Button>
      </div>
    </form>
  )
}
