interface ItemDefinition {
  readonly id: string
  readonly label: string
  readonly category: 'ore' | 'plate'
  readonly visual: { readonly shape: 'ore' | 'plate'; readonly color: number; readonly highlight: number; readonly accent: number; readonly shade: number }
}
export const ITEM_DEFINITIONS = {
  iron: { id: 'iron', label: 'Iron ore', category: 'ore', visual: { shape: 'ore', color: 0x526769, highlight: 0xb4cbd0, accent: 0x8da9b1, shade: 0x69848e } },
  ironPlate: { id: 'ironPlate', label: 'Iron plate', category: 'plate', visual: { shape: 'plate', color: 0xcbd8e2, highlight: 0xe2e8ec, accent: 0xe2e8ec, shade: 0x7a99ac } },
  copper: { id: 'copper', label: 'Copper ore', category: 'ore', visual: { shape: 'ore', color: 0x99532f, highlight: 0xf0ad70, accent: 0xde9259, shade: 0xc27b46 } },
  copperPlate: { id: 'copperPlate', label: 'Copper plate', category: 'plate', visual: { shape: 'plate', color: 0xcc7743, highlight: 0xffbd7d, accent: 0xffbd7d, shade: 0x925332 } },
} as const satisfies Record<string, ItemDefinition>
export type Item = keyof typeof ITEM_DEFINITIONS
export type Resource = { [I in Item]: typeof ITEM_DEFINITIONS[I]['category'] extends 'ore' ? I : never }[Item]
export const ITEMS: readonly Item[] = Object.keys(ITEM_DEFINITIONS) as Item[]
export const RESOURCES: readonly Resource[] = ITEMS.filter((item): item is Resource => ITEM_DEFINITIONS[item].category === 'ore')
export type Inventory = Record<Item, number>
export function emptyInventory(): Inventory { return Object.fromEntries(ITEMS.map(item => [item, 0])) as Inventory }
export function inventoryTotal(inventory: Readonly<Partial<Inventory>>): number {
  return ITEMS.reduce((sum, item) => sum + (inventory[item] ?? 0), 0)
}
