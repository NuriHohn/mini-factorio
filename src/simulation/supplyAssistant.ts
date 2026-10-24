import { ITEM_DEFINITIONS, inventoryTotal } from './items'
import type { Item } from './items'
import { PETE_PROJECTS, projectUnlocked } from './projectRegistry'
import { PROJECT_NAMES } from './peteStatus'
import { SUPPLY_CRATE_CAPACITY, supplyWood } from './supplyCrate'
import { SIZE } from './world'
import type { Storage, World } from './world'

export interface SupplyAmount { material: Item | 'wood'; label: string; required: number; stored: number; available: number }
export interface SupplyOffer { id: string; name: string; amounts: SupplyAmount[]; transferable: number; free: number }
function nearbyStores(world: World, index: number): Storage[] {
  const x = index % SIZE, y = Math.floor(index / SIZE)
  return world.buildings.filter((b): b is Storage => b?.kind === 'storage' && Math.abs(b.x - x) + Math.abs(b.y - y) <= 3)
    .sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - Math.abs(b.x - x) - Math.abs(b.y - y) || a.y - b.y || a.x - b.x)
}
export function supplyOffers(world: World, index: number): SupplyOffer[] {
  const crate = world.buildings[index]
  if (crate?.kind !== 'supplyCrate') return []
  const stores = nearbyStores(world, index), free = SUPPLY_CRATE_CAPACITY - crate.wood - inventoryTotal(crate.inventory)
  return PETE_PROJECTS.flatMap(d => {
    if (!projectUnlocked(world, d) || world[d.state]?.phase === 'building' || !Object.keys(d.resources).length) return []
    const entries = Object.entries(d.resources)
    if (entries.some(([m]) => m !== 'wood' && !Object.hasOwn(ITEM_DEFINITIONS, m))) return []
    const amounts = entries.map(([key, required]) => {
      const material = key as Item | 'wood'
      return { material, label: material === 'wood' ? 'Wood' : ITEM_DEFINITIONS[material].label, required, stored: material === 'wood' ? crate.wood : crate.inventory[material], available: material === 'wood' ? world.nature.wood : stores.reduce((n, b) => n + b.inventory[material], 0) }
    })
    const transferable = Math.min(free, amounts.reduce((n, a) => n + Math.min(Math.max(0, a.required - a.stored), a.available), 0))
    return [{ id: d.id, name: PROJECT_NAMES[d.id], amounts, transferable, free }]
  })
}
// Player-requested short-range handoff. No production, consumption, XP or new items.
export function supplyProject(world: World, index: number, id: string): number {
  const offer = supplyOffers(world, index).find(o => o.id === id), crate = world.buildings[index]
  if (!offer || crate?.kind !== 'supplyCrate') return 0
  let free = offer.free, moved = 0
  const stores = nearbyStores(world, index)
  for (const a of offer.amounts) {
    let count = Math.min(free, a.available, Math.max(0, a.required - a.stored))
    if (!count) continue
    if (a.material === 'wood') { if (!supplyWood(world, index, count)) continue }
    else {
      const amount = count
      for (const store of stores) { const take = Math.min(count, store.inventory[a.material]); store.inventory[a.material] -= take; count -= take }
      count = amount; crate.inventory[a.material] += count
    }
    free -= count; moved += count
  }
  return moved
}
