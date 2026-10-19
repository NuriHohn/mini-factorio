export const ITEMS = ['iron', 'ironPlate'] as const
export type Item = typeof ITEMS[number]
export type Inventory = Record<Item, number>
export const ITEM_LABELS: Record<Item, string> = { iron: 'Iron ore', ironPlate: 'Iron plate' }
export function emptyInventory(): Inventory { return { iron: 0, ironPlate: 0 } }
export function inventoryTotal(inventory: Readonly<Inventory>): number {
  return ITEMS.reduce((sum, item) => sum + inventory[item], 0)
}
