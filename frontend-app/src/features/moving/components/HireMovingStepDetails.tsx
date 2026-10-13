import { useTranslation } from 'react-i18next'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MultiImageUploadField } from '@/components/uploads/MultiImageUploadField'
import type { MasterDataItem } from '@/features/master-data/types'

import type { InventoryCatalogItem } from '../constants/inventory-catalog'
import { INVENTORY_CATEGORY_ORDER } from '../constants/inventory-catalog'
import type { MovingRequestFormValues } from '../schemas/moving-request-schema'
import { HireMovingField } from './HireMovingField'
import { InventoryItemRow } from './InventoryItemRow'
import { HireMovingStepNav } from './HireMovingStepNav'

const textareaClassName =
  'flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function HireMovingStepDetails({
  pickupAddress,
  dropoffAddress,
  register,
  errors,
  floors,
  catalog,
  inventoryCounts,
  totalInventoryItems,
  photoPaths,
  onPhotoChange,
  onInventoryChange,
  onBack,
}: {
  pickupAddress: string
  dropoffAddress: string
  register: UseFormRegister<MovingRequestFormValues>
  errors: FieldErrors<MovingRequestFormValues>
  floors: MasterDataItem[]
  catalog: InventoryCatalogItem[]
  inventoryCounts: Record<string, number>
  totalInventoryItems: string
  photoPaths: string[]
  onPhotoChange: (paths: string[]) => void
  onInventoryChange: (id: string, count: number) => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const catalogByCategory = INVENTORY_CATEGORY_ORDER.map((category) => ({
    category,
    items: catalog.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <p>
          <span className="font-medium">{t('moving.pickupAddress')}: </span>
          {pickupAddress}
        </p>
        <p>
          <span className="font-medium">{t('moving.dropoffAddress')}: </span>
          {dropoffAddress}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <HireMovingField label={t('moving.pickupFloor')} error={errors.pickupFloorLevelId?.message}>
          <select className={selectClassName} {...register('pickupFloorLevelId')}>
            <option value="">{t('houses.filters.any')}</option>
            {floors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
        </HireMovingField>
        <HireMovingField label={t('moving.dropoffFloor')} error={errors.dropoffFloorLevelId?.message}>
          <select className={selectClassName} {...register('dropoffFloorLevelId')}>
            <option value="">{t('houses.filters.any')}</option>
            {floors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
        </HireMovingField>
       
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">{t('moving.inventoryTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('moving.inventoryHint')}</p>
        </div>
        {catalogByCategory.map(({ category, items }) => (
          <div key={category} className="space-y-2 rounded-md border p-4">
            <h3 className="font-medium">{t(`moving.categories.${category}`)}</h3>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <InventoryItemRow key={item.id} item={item} count={inventoryCounts[item.id] ?? 0} onChange={onInventoryChange} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <HireMovingField
        label={t('moving.totalInventoryItems')}
        error={errors.totalInventoryItems?.message}
        className="max-w-xs"
      >
        <Input type="number" disabled readOnly value={totalInventoryItems} tabIndex={-1} />
      </HireMovingField>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t('moving.photosTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('moving.photosHint')}</p>
        <MultiImageUploadField
          paths={photoPaths}
          onChange={onPhotoChange}
          category="moving"
          maxFiles={5}
          error={errors.photo1?.message}
        />
      </section>

      <HireMovingField label={t('moving.damageChecklist')} error={errors.damageChecklist?.message} className="sm:col-span-2">
          <textarea className={textareaClassName} {...register('damageChecklist')} />
        </HireMovingField>
        <HireMovingField label={t('moving.remarks')} error={errors.remarks?.message} className="sm:col-span-2">
          <textarea className={textareaClassName} {...register('remarks')} />
        </HireMovingField>

      <HireMovingStepNav onBack={onBack}>
        <Button type="submit">{t('moving.continue')}</Button>
      </HireMovingStepNav>
    </div>
  )
}
