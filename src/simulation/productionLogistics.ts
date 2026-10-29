import { PETE_PROJECTS } from './projectRegistry'
import { inventoryTotal } from './items'
import type { Item, Inventory } from './items'
import type { LinkKind, LoadingSite } from './infrastructureRules'
import type { HomesteadExpansion } from './homesteadExpansion'
import type { Building, World } from './world'

export function productionEndpoints(kind: LinkKind, store: number | null, e: HomesteadExpansion, loading: LoadingSite | null, mill: number | null = null): [number | null, number | null] {
  if (kind === 'woodReturn') return [e.forestry === null || mill === null ? null : (e.forestry + mill) / 2, store]
  if (kind === 'panelReturn') return [mill === null ? null : mill + 1, store]
  if (kind === 'crateReturn') return [e.assembler, store]
  if (kind === 'circuitFeed') return [store, e.circuitAssembler]
  if (kind === 'circuitReturn') return [e.circuitAssembler, store]
  if (kind === 'stampFeed') return [e.fuelStore, e.briquetteAssembler]
  if (kind === 'loadingFeed') return [e.briquetteAssembler, loading?.input ?? null]
  if (kind === 'loadingReturn') return [loading?.output ?? null, e.fuelStore]
  const copper = ['copper', 'cableFeed', 'cableReturn'].includes(kind), machine = copper ? e.cableAssembler : e.gearAssembler
  return kind === 'iron' || kind === 'copper' ? [copper ? e.copperFurnace : e.furnace, store] : kind === 'gearFeed' || kind === 'cableFeed' ? [store, machine] : [machine, store]
}
export function mainFuel(world: World): number {
  const tile = world.homestead?.expansion.fuelStore, depot = tile === null || tile === undefined ? null : world.buildings[tile]
  return depot?.kind === 'fuelDepot' ? inventoryTotal(depot.inventory) : 0
}
export function fuelAutomation(world: World): boolean { return !!world.homestead?.infrastructure.links.some(p => p.kind === 'stampFeed') }
export function boilerPickupAllowed(world: World, tile: number, item: Item): boolean {
  const h = world.homestead, depot = h?.expansion.fuelStore === null || h?.expansion.fuelStore === undefined ? null : world.buildings[h.expansion.fuelStore]
  return !(fuelAutomation(world) && h?.expansion.coalInserter === tile && item === 'coalBriquette' && h.infrastructure.cargoCycles >= 10 && depot?.kind === 'fuelDepot' && depot.inventory.coal > 0 && depot.inventory.coalBriquette <= 6)
}
// Apply only to Pete's commissioned main depot. Old excess is retained; Factory stays ordinary.
export function fuelDeliveryAllowed(world: World, target: Building, item: Item, reserved: Readonly<Partial<Inventory>> = {}): boolean {
  if (!fuelAutomation(world) || target.kind !== 'fuelDepot' || world.homestead?.expansion.fuelStore !== target.y * Math.sqrt(world.tiles.length) + target.x) return true
  return target.inventory[item] + (reserved[item] ?? 0) < (item === 'coal' ? 12 : item === 'coalBriquette' ? 8 : 0)
}
export function flightReserve(world: World): number { return world.flightProject?.phase === 'complete' ? 0 : 12 }
export function protectsOutput(world: World, tiles: number[]): boolean {
  const e = world.homestead?.expansion
  if (!e) return false
  const h = world.homestead!, width = Math.sqrt(world.tiles.length)
  if (e.copperFurnace !== null && h.store !== null && !h.infrastructure.links.some(p => p.kind === 'circuitFeed') && tiles.some(t => [h.store! - width, h.store! - 2 * width, h.store! + width, h.store! + 2 * width].includes(t))) return true
  return [...outputClearance(world), ...inputClearance(world)].some(tile => tiles.includes(tile))
}
export function outputClearance(world: World, source?: number): number[] {
  const h = world.homestead
  if (!h) return []
  const e = h.expansion, width = Math.sqrt(world.tiles.length)
  const outputs: { tile: number | null; kind: LinkKind }[] = [{ tile: e.furnace, kind: 'iron' }, { tile: e.gearAssembler, kind: 'gearReturn' }, { tile: e.copperFurnace, kind: 'copper' }, { tile: e.cableAssembler, kind: 'cableReturn' }, { tile: e.circuitAssembler, kind: 'circuitReturn' }, { tile: e.briquetteAssembler, kind: 'loadingFeed' }]
  return outputs.flatMap(p => p.tile === null || p.tile === source || h.infrastructure.links.some(link => link.kind === p.kind) ? [] : [p.tile + 1, p.tile + 2, p.tile + 1 - width, p.tile + 1 + width, p.tile + 2 - width, p.tile + 2 + width])
}
export function inputClearance(world: World, target?: number): number[] {
  const h = world.homestead
  if (!h) return []
  const e = h.expansion, width = Math.sqrt(world.tiles.length), outputs = outputClearance(world)
  const inputs: { tile: number | null; kind: LinkKind }[] = [{ tile: e.gearAssembler, kind: 'gearFeed' }, { tile: e.cableAssembler, kind: 'cableFeed' }, { tile: e.circuitAssembler, kind: 'circuitFeed' }, { tile: e.briquetteAssembler, kind: 'stampFeed' }]
  const free = (tile: number) => tile >= 0 && tile < width * width && !world.buildings[tile] && !world.water[tile] && world.tiles[tile] === null && !outputs.includes(tile)
  return inputs.flatMap(p => {
    if (p.tile === null || p.tile === target || h.infrastructure.links.some(link => link.kind === p.kind)) return []
    const west = p.tile - 1
    if (west % width !== p.tile % width - 1 || !free(west)) return []
    const entry = [west - width, west - 1, west + width].find(tile => free(tile))
    return entry === undefined ? [west] : [west, entry]
  })
}
export function coalInlet(world: World): number[] {
  const e = world.homestead?.expansion
  if (!e || e.coalMiner === null || e.fuelStore === null) return []
  const repair = world.rebuilding?.jobs.find(j => j.owner.type === 'chain' && j.owner.plan.kind === 'coalMining' && j.owner.plan.anchor === e.coalMiner)
  if (repair?.owner.type === 'chain' && repair.owner.plan.route) return repair.owner.plan.route
  const width = Math.sqrt(world.tiles.length), route = [e.coalMiner]
  while (route.length < 13 && route.at(-1) !== e.fuelStore) {
    const tile = route.at(-1)!, b = world.buildings[tile]
    if (!b || (b.kind !== 'belt' && b.kind !== 'miner')) return []
    const next = tile + (b.direction === 'east' ? 1 : b.direction === 'west' ? -1 : b.direction === 'north' ? -width : width)
    if (next < 0 || next >= width * width || Math.abs(next % width - tile % width) > 1 || route.includes(next)) return []
    route.push(next)
  }
  return route.at(-1) === e.fuelStore ? route : []
}
export function ironReserve(world: World): number { return world.bicycleProject?.phase !== 'complete' ? 24 : !world.homestead?.cargoBicycle ? 12 : 2 }
export function inFlight(world: World, item: Item, kind?: LinkKind): number {
  const tiles = new Set((world.homestead?.infrastructure.links ?? []).filter(p => kind === undefined || p.kind === kind).flatMap(p => [...p.parts.map(b => b.tile), ...(p.inlet && p.receiver !== undefined ? p.inlet.slice(p.inlet.indexOf(p.receiver), -1) : [])]))
  return [...tiles].reduce((n, tile) => {
    const b = world.buildings[tile]
    return n + Number((b?.kind === 'belt' || b?.kind === 'inserter') && b.item === item)
  }, 0)
}
export function circuitStock(world: World): number {
  const h = world.homestead, tile = h?.expansion.circuitAssembler, machine = tile === null || tile === undefined ? null : world.buildings[tile], store = h?.store === null || h?.store === undefined ? null : world.buildings[h.store]
  return (store?.kind === 'supplyCrate' ? store.inventory.electronicCircuit : 0) + (machine?.kind === 'assembler' ? machine.output.electronicCircuit + (machine.job?.outputs.electronicCircuit ?? 0) : 0) + inFlight(world, 'electronicCircuit') + (h?.carried.electronicCircuit ?? 0)
}
export function laterPickup(world: World, kind: LinkKind, item: Item): boolean | null {
  const h = world.homestead!, e = h.expansion, s = h.infrastructure, store = h.store === null ? null : world.buildings[h.store]
  if (kind === 'circuitFeed') {
    const machine = e.circuitAssembler === null ? null : world.buildings[e.circuitAssembler]
    if (store?.kind !== 'supplyCrate' || machine?.kind !== 'assembler') return false
    if (machine.recipeId === 'electronicCircuit') return item === 'copperCable' && legacyCircuitIron(world) > 0 && machine.input.copperCable + inFlight(world, item, kind) < Math.min(6, legacyCircuitIron(world) * 3) && store.inventory.copperCable > 0
    if (machine.recipeId !== 'peteCircuit' || !['copperPlate', 'copperCable'].includes(item)) return false
    const batches = Math.min(2, Math.max(0, 12 - circuitStock(world)))
    return machine.input[item] + inFlight(world, item, kind) < batches * (item === 'copperPlate' ? 1 : 3) && store.inventory[item] > (item === 'copperPlate' ? world.flightProject?.phase === 'complete' ? 2 : 24 : flightReserve(world))
  }
  if (kind === 'circuitReturn') return item === 'electronicCircuit' && store?.kind === 'supplyCrate' && store.inventory.electronicCircuit + inFlight(world, item) < 12
  if (kind === 'stampFeed') {
    if (item !== 'coal' || mainFuel(world) <= 8) return false
    const machine = e.briquetteAssembler === null ? null : world.buildings[e.briquetteAssembler]
    if (machine?.kind !== 'assembler' || machine.recipeId !== 'coalBriquette') return false
    const stocked = [e.fuelStore, s.loading?.input, s.loading?.output].reduce<number>((n, tile) => { const b = tile === null || tile === undefined ? null : world.buildings[tile]; return n + (b?.kind === 'fuelDepot' ? b.inventory.coalBriquette : 0) }, 0)
    const bricks = stocked + inFlight(world, 'coalBriquette') + machine.output.coalBriquette + (machine.job?.outputs.coalBriquette ?? 0) + h.carried.coalBriquette + Number(s.loadingCargo === 'coalBriquette') + (store?.kind === 'supplyCrate' ? store.inventory.coalBriquette : 0)
    return machine.input.coal + inFlight(world, 'coal', kind) < Math.min(4, Math.max(0, 8 - bricks) * 2)
  }
  if (kind === 'loadingFeed') {
    const input = s.loading ? world.buildings[s.loading.input] : null
    return item === 'coalBriquette' && mainFuel(world) >= 8 && input?.kind === 'fuelDepot' && inventoryTotal(input.inventory) + inFlight(world, item, kind) < 6
  }
  if (kind === 'loadingReturn') {
    const depot = e.fuelStore === null ? null : world.buildings[e.fuelStore]
    return (item === 'coal' || item === 'coalBriquette') && depot?.kind === 'fuelDepot' && depot.inventory[item] + inFlight(world, item, kind) < (item === 'coal' ? 12 : 8)
  }
  return null
}

export function ecoWoodReserve(world: World): number {
  const h = world.homestead
  if (!h || h.expansion.assembler === null || h.expansion.forestry === null) return 0
  if (['woodReturn', 'panelReturn', 'crateReturn'].some(kind => !h.infrastructure.links.some(p => p.kind === kind))) return 18
  if (world.personality.paths.eco.level >= 4 && world.nurseryProject?.phase !== 'complete') return PETE_PROJECTS.find(p => p.id === 'nursery')!.resources.wood!
  return world.personality.paths.eco.level >= 5 && h.infrastructure.pavilion?.stage !== 3 ? 12 : 0
}

// Already paid old iron batches and packets drain before the owned machine is retuned.
export function legacyCircuitIron(world: World): number {
  const h = world.homestead, at = h?.expansion.circuitAssembler, machine = at === null || at === undefined ? null : world.buildings[at]
  if (!h || machine?.kind !== 'assembler') return 0
  const plans = [...h.infrastructure.links, ...(h.infrastructure.plan ? [h.infrastructure.plan] : [])].filter(p => p.kind === 'circuitFeed')
  const tiles = new Set(plans.flatMap(p => p.parts.map(b => b.tile)))
  return machine.input.ironPlate + (machine.job?.inputs.ironPlate ?? 0) + (h.task === 'feedCircuits' ? h.carried.ironPlate : 0) + [...tiles].reduce((n, at) => { const b = world.buildings[at]; return n + Number((b?.kind === 'belt' || b?.kind === 'inserter') && b.item === 'ironPlate') }, 0)
}
