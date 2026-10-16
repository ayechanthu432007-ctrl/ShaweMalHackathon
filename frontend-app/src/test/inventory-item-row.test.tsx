import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { InventoryItemRow, inventoryItemIcon } from '@/features/moving/components/InventoryItemRow'
import type { InventoryCatalogItem } from '@/features/moving/constants/inventory-catalog'
import { renderWithProviders } from '@/test/utils'

const catalog: InventoryCatalogItem[] = [
  { id: 'bed', code: 'bedroom_single_bed', category: 'bedroom', itemName: 'Single bed', points: 4 },
  { id: 'chair', code: 'bedroom_chair', category: 'bedroom', itemName: 'Chair', points: 1 },
]

function Inventory() {
  const [counts, setCounts] = useState<Record<string, number>>({ bed: 0, chair: 0 })
  return (
    <ul>
      {catalog.map((item) => (
        <InventoryItemRow key={item.id} item={item} count={counts[item.id] ?? 0} onChange={(id, next) => setCounts((current) => ({ ...current, [id]: next }))} />
      ))}
    </ul>
  )
}

describe('moving inventory row', () => {
  it('lays each row out as icon, name, minus, quantity, plus', () => {
    renderWithProviders(<Inventory />)

    const row = screen.getAllByRole('listitem')[0]!
    expect(row.textContent).toMatch(/^Single bed.*0$/)
    // Bedroom items use one dark-grey line icon each, not colour emoji.
    const icon = row.querySelector('svg[data-inventory-icon="mono"]')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('class')).toContain('text-[#333333]')
    const controls = within(row).getByRole('group', { name: 'Quantity of Single bed' })
    expect([...controls.children].map((element) => element.getAttribute('aria-label') ?? element.textContent)).toEqual([
      'Remove one Single bed',
      '0',
      'Add one Single bed',
    ])
  })

  it('changes only its own item, one at a time, and never goes below zero', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Inventory />)
    const quantity = (name: string) => within(screen.getByRole('group', { name: `Quantity of ${name}` })).getByRole('status').textContent

    expect(screen.getByRole('button', { name: 'Remove one Single bed' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Add one Single bed' }))
    await user.click(screen.getByRole('button', { name: 'Add one Single bed' }))
    expect(quantity('Single bed')).toBe('2')
    expect(quantity('Chair')).toBe('0')

    await user.click(screen.getByRole('button', { name: 'Remove one Single bed' }))
    await user.click(screen.getByRole('button', { name: 'Remove one Single bed' }))
    await user.click(screen.getByRole('button', { name: 'Remove one Single bed' }))
    expect(quantity('Single bed')).toBe('0')
  })

  it('has a picture for every catalogue item, including ones added later', () => {
    expect(inventoryItemIcon({ code: 'kitchen_refrigerator', itemName: 'Refrigerator', category: 'kitchen' })).toBe('🧊')
    expect(inventoryItemIcon({ code: 'new_big_box', itemName: 'Big Box', category: 'other' })).toBe('📦')
    expect(inventoryItemIcon({ code: 'new_thing', itemName: 'Piano', category: 'living' })).toBe('🛋️')
  })
})
