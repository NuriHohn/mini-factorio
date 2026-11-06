import { ITEMS } from './items'
import type { Inventory, Item } from './items'
import type { SupplyCrate, World } from './world'

export function separateCircuitInputsUnlocked(world: World): boolean {
  const h = world.homestead, at = h?.expansion.circuitAssembler
  return !!h && at !== null && at !== undefined && world.buildings[at]?.kind === 'assembler' && world.buildings[at].recipeId === 'peteCircuit' &&
    world.flightProject?.phase === 'complete' && (world.leisure?.practices ?? 0) > 0 &&
    ['copper', 'cableFeed', 'cableReturn', 'circuitFeed'].every(kind => h.infrastructure.links.some(p => p.kind === kind))
}

export function cargoBatch(world: World): number { return world.homestead?.transportUpgrade ? 12 : 6 }
export function transportUnlocked(world: World): boolean {
  const h = world.homestead
  return !!h?.cargoBicycle && h.infrastructure.inventor >= 3 && ['iron', 'gearFeed', 'gearReturn', 'circuitReturn', 'circuitCableFeed'].every(kind => h.infrastructure.links.some(p => p.kind === kind))
}

export const NURSERY_WOOD_COST = 24
export const SUPPLY_RESERVES = { eco: 18, craftsman: 12, inventor: 12, industrial: 8 } as const
export function ecoWoodReserve(world: World): number {
  const h = world.homestead
  if (!h || h.expansion.assembler === null || h.expansion.forestry === null) return 0
  if (['woodReturn', 'panelReturn', 'crateReturn'].some(kind => !h.infrastructure.links.some(p => p.kind === kind))) return 18
  if (world.personality.paths.eco.level >= 4 && world.nurseryProject?.phase !== 'complete') return NURSERY_WOOD_COST
  return world.personality.paths.eco.level >= 5 && h.infrastructure.pavilion?.stage !== 3 ? 12 : 0
}

// One owner for reserves and targets; manual bootstrap differences are intentional.
export function materialPolicy(world: World) {
  const h = world.homestead, flightComplete = world.flightProject?.phase === 'complete'
  const iron = world.bicycleProject?.phase !== 'complete' ? 24 : !h?.cargoBicycle ? 12 : 2
  const copperLinks = h?.infrastructure.links.filter(p => ['copper', 'cableFeed', 'cableReturn', 'circuitFeed', 'circuitReturn'].includes(p.kind)).length ?? 0
  const advanced = separateCircuitInputsUnlocked(world)
  const manualCopper = flightComplete && copperLinks < 5 ? 8 : 0
  return {
    fuelReserve: 8,
    coalTarget: 12,
    briquetteTarget: 8,
    ironPlate: iron,
    manualGearPlate: world.verandaProject?.phase !== 'complete' ? 20 : iron,
    copperPlate: flightComplete ? 2 : 24,
    copperCable: flightComplete ? 0 : 12,
    manualCopperPlate: manualCopper,
    manualCircuitPlate: world.personality.paths.inventor.level >= 4 && !h?.infrastructure.links.some(p => p.kind === 'copper') ? 8 : manualCopper,
    plateTarget: 40,
    copperPlateTarget: (advanced ? 56 : 40) + (h?.expansion.transportAssembler !== undefined ? 4 : 0),
    ironGearTarget: h?.expansion.transportAssembler !== undefined ? 8 : 12,
    copperCableTarget: advanced ? 8 : 16,
    electronicCircuitTarget: h?.expansion.transportAssembler !== undefined ? 8 : 12,
    manualCircuitTarget: flightComplete ? 12 : 8,
  }
}
export function storedMaterial(store: SupplyCrate, item: Item): number {
  return item === 'wood' ? store.wood : store.inventory[item]
}
export function availableMaterial(store: SupplyCrate, item: Item, reserve = 0): number {
  return Math.max(0, storedMaterial(store, item) - reserve)
}
export function materialDemand(store: SupplyCrate, resources: Partial<Inventory>, paid = false) {
  const costs: Partial<Inventory> = {}, reserved: Partial<Inventory> = {}, missing: Partial<Inventory> = {}
  for (const item of ITEMS) {
    const amount = resources[item] ?? 0
    if (!amount) continue
    costs[item] = amount
    reserved[item] = paid ? 0 : Math.min(amount, storedMaterial(store, item))
    missing[item] = paid ? 0 : amount - reserved[item]!
  }
  return { costs, reserved, missing }
}

// The unupgraded main store retains eight free spaces; surplus belongs in extra stores.
export function mainStoreTargets(world: World): Record<Item, number> {
  const p = materialPolicy(world)
  const raw = separateCircuitInputsUnlocked(world) ? 2 : 6
  return { wood: 24, woodPanel: 12, woodenCrate: 8, iron: raw, copper: raw,
    ironPlate: p.plateTarget, copperPlate: p.copperPlateTarget, ironGear: p.ironGearTarget,
    copperCable: p.copperCableTarget, electronicCircuit: p.electronicCircuitTarget,
    coal: p.coalTarget, coalBriquette: 4, mechanicModule: 0, transportModule: world.homestead?.expansion.transportAssembler !== undefined ? 4 : 0 }
}
