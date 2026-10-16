import {
  AirVent,
  Archive,
  Armchair,
  Bed,
  BedDouble,
  BedSingle,
  Bike,
  Coffee,
  CookingPot,
  DoorClosed,
  Fan,
  Flame,
  GlassWater,
  Lamp,
  LampDesk,
  Laptop,
  Layers2,
  Library,
  Microwave,
  Minus,
  Monitor,
  Motorbike,
  Package,
  Plus,
  Printer,
  Refrigerator,
  ScanFace,
  Sofa,
  Sprout,
  Tv,
  TvMinimal,
  UtensilsCrossed,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react'
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
 * Every inventory item gets a plain line icon in one dark grey, so the whole list reads as one
 * consistent set. Items an admin adds later get a fitting icon from their name, or a box.
 */
const MONO_ICON_BY_CODE: Record<string, LucideIcon> = {
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
  living_sofa_1: Armchair,
  living_sofa_2: Sofa,
  living_sofa_3: Sofa,
  living_coffee_table: Coffee,
  living_tv: Tv,
  living_tv_stand: TvMinimal,
  living_shelf: Archive,
  living_fan: Fan,
  living_air_conditioner: AirVent,
  kitchen_refrigerator: Refrigerator,
  kitchen_microwave: Microwave,
  kitchen_rice_cooker: CookingPot,
  kitchen_washing_machine: WashingMachine,
  kitchen_water_dispenser: GlassWater,
  kitchen_stove: Flame,
  kitchen_dining_table: UtensilsCrossed,
  kitchen_dining_chair: Armchair,
  office_desktop: Monitor,
  office_laptop: Laptop,
  office_printer: Printer,
  office_chair: Armchair,
  office_desk: LampDesk,
  other_bicycles: Bike,
  other_motorcycle: Motorbike,
  other_plants: Sprout,
  other_boxes: Package,
}

const MONO_ICON_BY_KEYWORD: Array<[RegExp, LucideIcon]> = [
  [/box|carton/i, Package],
  [/bed|mattress/i, Bed],
  [/sofa|couch/i, Sofa],
  [/chair|stool/i, Armchair],
  [/table|desk/i, LampDesk],
  [/shelf|cabinet|wardrobe|stand/i, Archive],
  [/tv|television/i, Tv],
  [/computer|desktop|monitor/i, Monitor],
  [/laptop/i, Laptop],
  [/fridge|refrigerator/i, Refrigerator],
  [/fan/i, Fan],
  [/bicycle|bike/i, Bike],
  [/motor/i, Motorbike],
  [/plant/i, Sprout],
]

export function inventoryItemMonoIcon(item: Pick<InventoryCatalogItem, 'code' | 'itemName'>): LucideIcon {
  return MONO_ICON_BY_CODE[item.code] ?? MONO_ICON_BY_KEYWORD.find(([pattern]) => pattern.test(item.itemName))?.[1] ?? Package
}

function InventoryItemGlyph({ item }: { item: Pick<InventoryCatalogItem, 'code' | 'itemName'> }) {
  const Icon = inventoryItemMonoIcon(item)
  return <Icon className="size-5 text-[#333333] dark:text-foreground" strokeWidth={1.75} aria-hidden data-inventory-icon="mono" />
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
