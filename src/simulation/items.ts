interface ItemDefinition {
  readonly id: string
  readonly label: string
  readonly category: 'ore' | 'plate' | 'component'
  readonly visual: { readonly shape: 'ore' | 'plate' | 'gear' | 'cable' | 'circuit' | 'component'; readonly color: number; readonly highlight: number; readonly accent: number; readonly shade: number }
}
export const ITEM_DEFINITIONS = {
  iron: { id: 'iron', label: 'Iron ore', category: 'ore', visual: { shape: 'ore', color: 0x526769, highlight: 0xb4cbd0, accent: 0x8da9b1, shade: 0x69848e } },
  ironPlate: { id: 'ironPlate', label: 'Iron plate', category: 'plate', visual: { shape: 'plate', color: 0xcbd8e2, highlight: 0xe2e8ec, accent: 0xe2e8ec, shade: 0x7a99ac } },
  copper: { id: 'copper', label: 'Copper ore', category: 'ore', visual: { shape: 'ore', color: 0x99532f, highlight: 0xf0ad70, accent: 0xde9259, shade: 0xc27b46 } },
  copperPlate: { id: 'copperPlate', label: 'Copper plate', category: 'plate', visual: { shape: 'plate', color: 0xcc7743, highlight: 0xffbd7d, accent: 0xffbd7d, shade: 0x925332 } },
  ironGear: { id: 'ironGear', label: 'Iron gear', category: 'component', visual: { shape: 'gear', color: 0xb8cbd2, highlight: 0xe6eff1, accent: 0x829da8, shade: 0x526a76 } },
  copperCable: { id: 'copperCable', label: 'Copper cable', category: 'component', visual: { shape: 'cable', color: 0xf3a35b, highlight: 0xffd392, accent: 0xdb843d, shade: 0x884521 } },
  electronicCircuit: { id: 'electronicCircuit', label: 'Electronic circuit', category: 'component', visual: { shape: 'circuit', color: 0x4dac72, highlight: 0xf8d575, accent: 0x81d5a0, shade: 0x205239 } },
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
