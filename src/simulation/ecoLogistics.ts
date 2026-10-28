import { infrastructurePickupAllowed } from './infrastructure'
import { inFlight } from './productionLogistics'
import type { Item } from './items'
import type { LinkKind } from './infrastructureRules'
import type { World } from './world'

// Return arms take packets from the existing production belts, never from a reserved seedling.
export function ecoPickup(world: World, kind: LinkKind, item: Item): boolean | null {
  if (!['woodReturn', 'panelReturn', 'crateReturn'].includes(kind)) return null
  const h = world.homestead!, store = h.store === null ? null : world.buildings[h.store]
  if (store?.kind !== 'supplyCrate') return false
  if (kind === 'woodReturn') {
    const mill = h.millAnchor === null ? null : world.buildings[h.millAnchor]
    return item === 'wood' && store.wood + h.carried.wood + inFlight(world, item) < 48 &&
      (store.wood < 24 || mill?.kind === 'sawmill' && mill.input.wood >= 2)
  }
  if (kind === 'panelReturn') {
    const assembler = h.expansion.assembler === null ? null : world.buildings[h.expansion.assembler]
    return item === 'woodPanel' && store.inventory.woodPanel + h.carried.woodPanel + inFlight(world, item) < 32 &&
      (store.inventory.woodPanel < 8 || assembler?.kind === 'assembler' && assembler.input.woodPanel >= 4)
  }
  return item === 'woodenCrate' && store.inventory.woodenCrate + h.carried.woodenCrate + inFlight(world, item) < 8
}

// Reserve one real ready packet for a powered owned return arm. Other belt arbitration is unchanged.
export function ecoReturnClaim(world: World, source: number, item: Item): boolean {
  const link = world.homestead?.infrastructure.links.find(p => p.source === source && (p.kind === 'woodReturn' || p.kind === 'panelReturn'))
  if (!link) return false
  const arm = world.buildings[link.parts[2].tile], drop = world.buildings[link.parts[3].tile]
  return arm?.kind === 'inserter' && drop?.kind === 'belt' && !drop.item &&
    (arm.sabotageUntilMs ?? 0) <= world.timeMs && !!world.power?.networks.some(n => n.id === world.power?.assignments[link.parts[2].tile] && n.capacityKw > 0) && infrastructurePickupAllowed(world, link.parts[2].tile, item)
}
