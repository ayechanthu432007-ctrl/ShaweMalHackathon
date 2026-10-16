import { Armchair, Bed, BedDouble, BedSingle, DoorClosed, Lamp, LampDesk, Layers2, Library, Minus, Plus, ScanFace, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { InventoryCatalogItem } from '../constants/inventory-catalog'

/** A small picture for each catalogue item, by its code. */
const ICON_BY_CODE: Record<string, string> = {
  bedroom_single_bed: '🛏️',
  bedroom_couple_bed: '🛏️',
  bedroom_king_bed: '🛏️',
  bedroom_mattress: '🛌',
  bedroom_wardrobe: '🚪',
  bedroom_dressing_table: '🪞',
  bedroom_bedside_table: '🗄️',
  bedroom_chair: '🪑',
  bedroom_study_table: '📝',
  bedroom_bookshelf: '📚',
  living_sofa_1: '🛋️',
  living_sofa_2: '🛋️',
  living_sofa_3: '🛋️',
  living_coffee_table: '☕',
  living_tv: '📺',
  living_tv_stand: '🗄️',
  living_shelf: '🗃️',
  living_fan: '🌀',
  living_air_conditioner: '❄️',
  kitchen_refrigerator: '🧊',
  kitchen_microwave: '♨️',
  kitchen_rice_cooker: '🍚',
  kitchen_washing_machine: '🧺',
  kitchen_water_dispenser: '🚰',
  kitchen_stove: '🍳',
  kitchen_dining_table: '🍽️',
  kitchen_dining_chair: '🪑',
  office_desktop: '🖥️',
  office_laptop: '💻',
  office_printer: '🖨️',
  office_chair: '💺',
  office_desk: '🗂️',
  other_bicycles: '🚲',
  other_motorcycle: '🏍️',
  other_plants: '🪴',
  other_boxes: '📦',
}

/**
 * Bedroom items use plain line icons in one dark grey instead of colour emoji, so the list reads
 * as one consistent set. Other rooms keep their pictures for now.
 */
const BEDROOM_ICON_BY_CODE: Record<string, LucideIcon> = {
  bedroom_single_bed: BedSingle,
  bedroom_couple_bed: BedDouble,
  bedroom_king_bed: BedDouble,
  bedroom_mattress: Layers2,
  bedroom_wardrobe: DoorClosed,
  bedroom_dressing_table: ScanFace,
  bedroom_bedside_table: Lamp,
  bedroom_chair: Armchair,
  bedroom_study_table: LampDesk,
  bedroom_bookshelf: Library,
}

function InventoryItemGlyph({ item }: { item: Pick<InventoryCatalogItem, 'code' | 'itemName' | 'category'> }) {
  if (item.category === 'bedroom') {
    const Icon = BEDROOM_ICON_BY_CODE[item.code] ?? Bed
    return <Icon className="size-5 text-[#333333] dark:text-foreground" strokeWidth={1.75} aria-hidden data-inventory-icon="mono" />
  }
  return <>{inventoryItemIcon(item)}</>
}

/** Items an admin adds later still get a fitting picture from their name. */
const ICON_BY_KEYWORD: Array<[RegExp, string]> = [
  [/box|carton/i, '📦'],
  [/bed|mattress/i, '🛏️'],
  [/sofa|couch/i, '🛋️'],
  [/chair|stool/i, '🪑'],
  [/table|desk/i, '🗂️'],
  [/shelf|cabinet|wardrobe|stand/i, '🗄️'],
  [/tv|television/i, '📺'],
  [/computer|desktop/i, '🖥️'],
  [/laptop/i, '💻'],
  [/fridge|refrigerator/i, '🧊'],
  [/fan/i, '🌀'],
  [/bicycle|bike/i, '🚲'],
  [/motor/i, '🏍️'],
  [/plant/i, '🪴'],
]

const CATEGORY_ICON: Record<string, string> = { bedroom: '🛏️', living: '🛋️', kitchen: '🍽️', office: '💼', other: '📦' }

export function inventoryItemIcon(item: Pick<InventoryCatalogItem, 'code' | 'itemName' | 'category'>): string {
  return (
    ICON_BY_CODE[item.code] ??
    ICON_BY_KEYWORD.find(([pattern]) => pattern.test(item.itemName))?.[1] ??
    CATEGORY_ICON[item.category] ??
    '📦'
  )
}

const stepButtonClassName =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40'

type InventoryItemRowProps = {
  item: InventoryCatalogItem
  count: number
  onChange: (id: string, count: number) => void
}

/** One inventory item: picture and name on the left, then minus, quantity and plus on the right. */
export function InventoryItemRow({ item, count, onChange }: InventoryItemRowProps) {
  const { t } = useTranslation()

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-lg leading-none" aria-hidden>
          <InventoryItemGlyph item={item} />
        </span>
        <span className="min-w-0 text-sm">
          <span className="block truncate font-medium">{item.itemName}</span>
          <span className="block text-xs text-muted-foreground">{t('moving.inventoryPoints', { points: item.points })}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={t('moving.inventoryQuantityOf', { item: item.itemName })}>
        <button
          type="button"
          className={stepButtonClassName}
          aria-label={t('moving.inventoryDecrease', { item: item.itemName })}
          disabled={count <= 0}
          onClick={() => onChange(item.id, Math.max(0, count - 1))}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <output className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {count}
        </output>
        <button
          type="button"
          className={stepButtonClassName}
          aria-label={t('moving.inventoryIncrease', { item: item.itemName })}
          onClick={() => onChange(item.id, count + 1)}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  )
}
