import { legacyCircuitIron, protectsOutput } from './productionLogistics'
import { connectionRunning, planConnection, previewConnection } from './infrastructure'
import { chooseCraftsman, advanceCraftsman } from './craftsman'
import { advanceIndustrial, chooseIndustrial, industrialLayout, planIndustrial } from './industrial'
import { INDUSTRIAL_CHAINS } from './industrialRules'
import { awardHomesteadOnce } from './rebuilding'
import { findBeltRoute } from './beltRouting'
import type { PersonalityPath } from './personality'
import { recordProduction } from './analytics'
import { changeCraftingRecipe } from './crafting'
import type { RecipeId } from './recipes'
import { copperLink } from './infrastructureRules'
import { forestTiles } from './forestryStation'
import { planHarvest } from './forestry'
import { treeStage } from './nature'
import { arrived, begin, finish, freeSite, materialStore } from './homestead'
import { emptyInventory, inventoryTotal } from './items'
import type { Inventory, Item } from './items'
import { miniApproach } from './petesWorld'
import { neighboringTiles } from './navigation'
import { awardActivity } from './personality'
import { supplyCapacity } from './supplyCrate'
import { deliverItem } from './transport'
import { inside, offsets, placeBuilding, SIZE } from './world'
import type { BuildingKind, Direction, World } from './world'

export const IMPROVEMENTS = ['coopAwning', 'gardenBench', 'storeShelves', 'gardenBoxes'] as const
export type Improvement = typeof IMPROVEMENTS[number]
export const IMPROVEMENT_RULES: Record<Improvement, { label: string; item: Item; amount: number; xp: number }> = {
  coopAwning: { label: 'Vordach am Hühnerstall', item: 'woodPanel', amount: 6, xp: 8 },
  gardenBench: { label: 'Gartenbank', item: 'woodPanel', amount: 6, xp: 8 },
  storeShelves: { label: 'Lagerregale', item: 'woodenCrate', amount: 4, xp: 12 },
  gardenBoxes: { label: 'Pflanzkästen am Garten', item: 'woodenCrate', amount: 3, xp: 12 },
}
export const CHAIN_KINDS = ['gears', 'forestry', 'crates', 'iron', 'ironMining', 'copper', 'cables', 'copperMining', 'circuits', 'steam', ...INDUSTRIAL_CHAINS] as const
export type ChainKind = typeof CHAIN_KINDS[number]
export interface ExpansionPlan { kind: ChainKind; anchor: number; direction: Direction; built: number; route?: number[] }
export interface HomesteadExpansion {
  improvements: Partial<Record<Improvement, number>>
  improvement: Improvement | null
  plan: ExpansionPlan | null
  forestry: number | null
  assembler: number | null
  furnace: number | null
  miner: number | null
  copperFurnace: number | null
  gearAssembler: number | null
  cableAssembler: number | null
  copperMiner: number | null
  circuitAssembler: number | null
  steamEngine: number | null
  coalMiner: number | null
  fuelStore: number | null
  coalInserter: number | null
  briquetteAssembler: number | null
  steamWorkshop: number | null
  steamHoist: number | null
}
export function createExpansion(): HomesteadExpansion { return { gearAssembler: null, improvements: {}, improvement: null, plan: null, forestry: null, assembler: null, furnace: null, miner: null, copperFurnace: null, cableAssembler: null, copperMiner: null, circuitAssembler: null, steamEngine: null, coalMiner: null, fuelStore: null, coalInserter: null, briquetteAssembler: null, steamWorkshop: null, steamHoist: null } }
export function expansionLayout(plan: ExpansionPlan): { tile: number; kind: BuildingKind; direction: Direction }[] {
  const industry = industrialLayout(plan)
  if (industry) return industry
  const a = plan.anchor, d = plan.direction, step = offsets[d].y * SIZE + offsets[d].x
  if (plan.kind === 'forestry') return [{ tile: a, kind: 'forester', direction: d }, { tile: a + step, kind: 'belt', direction: d }]
  const row = d === 'north' ? -SIZE : SIZE
  if ((plan.kind === 'ironMining' || plan.kind === 'copperMining')) {
    const route = plan.route ?? []
    const direction = (from: number, to: number): Direction => to === from + 1 ? 'east' : to === from - 1 ? 'west' : to > from ? 'south' : 'north'
    return [{ tile: a + row, kind: 'powerPole', direction: 'east' }, { tile: a + row + 1, kind: 'generator', direction: 'east' }, ...route.slice(1).map((tile, i) => ({ tile, kind: 'belt' as const, direction: i + 2 < route.length ? direction(tile, route[i + 2]) : 'east' as const })), { tile: a, kind: 'miner', direction: direction(a, route[1]) }]
  }
  if (plan.kind === 'steam') return [{ tile: a + row, kind: 'powerPole', direction: 'east' }, { tile: a, kind: 'steamEngine', direction: 'east' }]
  if ((plan.kind === 'cables' || plan.kind === 'circuits') && d === 'east') return [{ tile: a + 3, kind: 'powerPole', direction: 'east' }, { tile: a + 4, kind: 'generator', direction: 'east' }, { tile: a, kind: 'assembler', direction: 'east' }]
  if (plan.kind === 'gears' || plan.kind === 'cables' || plan.kind === 'circuits') return [{ tile: a + row, kind: 'powerPole', direction: 'east' }, { tile: a + row + 1, kind: 'generator', direction: 'east' }, { tile: a, kind: 'assembler', direction: 'east' }]
  if (plan.kind === 'crates') return [{ tile: a + row, kind: 'powerPole', direction: 'east' }, { tile: a + row + 1, kind: 'generator', direction: 'east' }, { tile: a - 1, kind: 'belt', direction: 'east' }, { tile: a, kind: 'assembler', direction: 'east' }]
  return [{ tile: a + row, kind: 'powerPole', direction: 'east' }, { tile: a + row + 1, kind: 'generator', direction: 'east' }, { tile: a, kind: 'furnace', direction: 'east' }]
}
export function chainCost(kind: ChainKind): Partial<Inventory> { return INDUSTRIAL_CHAINS.some(k => k === kind) ? { coal: 6 } : kind === 'steam' ? { coal: 6 } : kind === 'circuits' ? { copperPlate: 12 } : kind === 'copper' ? { copper: 6 } : kind === 'gears' ? { ironPlate: 8 } : kind === 'cables' ? { copperPlate: 8 } : kind === 'copperMining' ? { copperPlate: 8 } : kind === 'ironMining' ? { ironPlate: 8 } : kind === 'iron' ? { iron: 6 } : kind === 'forestry' ? { woodPanel: 8, wood: 1 } : { woodPanel: 12 } }
function improvementSite(world: World, id: Improvement): number | null {
  const p = id === 'coopAwning' ? world.coopProject : id === 'gardenBench' || id === 'gardenBoxes' ? world.gardenProject : null
  return id === 'storeShelves' ? world.homestead!.store : p?.phase === 'complete' && world.buildings[p.tiles[0]] ? p.tiles[0] : null
}
export function ironSite(world: World, ore: 'iron' | 'copper' | 'coal' = 'iron'): number | null {
  const home = world.peace.home
  if (home === null) return null
  return world.tiles.map((ore, tile) => ({ ore, tile, distance: Math.abs(tile % SIZE - world.pete.tile % SIZE) + Math.abs(Math.floor(tile / SIZE) - Math.floor(world.pete.tile / SIZE)) }))
    .filter(p => p.ore === ore && !world.water[p.tile] && !world.buildings[p.tile] && Math.max(Math.abs(p.tile % SIZE - home % SIZE), Math.abs(Math.floor(p.tile / SIZE) - Math.floor(home / SIZE))) <= 11)
    .sort((a, b) => a.distance - b.distance || a.tile - b.tile).find(p => miniApproach(world, p.tile) !== null)?.tile ?? null
}
function chainCandidates(world: World, kind: ChainKind): ExpansionPlan[] {
  const h = world.homestead!, candidates: ExpansionPlan[] = []
  if (kind === 'forestry' && h.millAnchor !== null) {
    for (const direction of ['east', 'south', 'north'] as const) {
      const d = offsets[direction], a = h.millAnchor - 2 * (d.y * SIZE + d.x)
      if (Math.abs(a % SIZE - h.millAnchor % SIZE) > 2) continue
      candidates.push({ kind, anchor: a, direction, built: 0 })
    }
  } else if (kind === 'crates' && h.millAnchor !== null && h.millAnchor % SIZE < SIZE - 3) {
    for (const direction of ['north', 'south'] as const) candidates.push({ kind, anchor: h.millAnchor + 2, direction, built: 0 })
  }
  else if (kind === 'iron' || kind === 'copper' || kind === 'gears' || kind === 'cables' || kind === 'circuits' || kind === 'steam') {
    const home = world.peace.home!
    for (let radius = 3; radius <= 7; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
      const x = home % SIZE + dx, y = Math.floor(home / SIZE) + dy
      if (x > 0 && x < SIZE - 2 && y > 0 && y < SIZE - 2) {
        if (kind === 'circuits' && x < SIZE - 4) candidates.push({ kind, anchor: y * SIZE + x, direction: 'east', built: 0 })
        for (const direction of ['north', 'south'] as const) candidates.push({ kind, anchor: y * SIZE + x, direction, built: 0 })
        if (kind === 'cables' && x < SIZE - 4) candidates.push({ kind, anchor: y * SIZE + x, direction: 'east', built: 0 })
      }
    }
  }
  if (kind === 'iron' || kind === 'copper' || kind === 'steam') {
    const deposits = world.tiles.flatMap((ore, tile) => ore === (kind === 'steam' ? 'coal' : kind === 'iron' ? 'iron' : 'copper') && !world.water[tile] ? [tile] : [])
    const distance = (plan: ExpansionPlan) => Math.min(...deposits.map(tile => Math.abs(tile % SIZE - (plan.anchor % SIZE - 1)) + Math.abs(Math.floor(tile / SIZE) - Math.floor(plan.anchor / SIZE))))
    candidates.sort((a, b) => distance(a) - distance(b))
  }
  return candidates.filter(p => expansionLayout(p).every(s => inside(s.tile % SIZE, Math.floor(s.tile / SIZE))))
}
export function planChain(world: World, kind: ChainKind): ExpansionPlan | null {
  if (INDUSTRIAL_CHAINS.some(k => k === kind)) return planIndustrial(world, kind)
  if (kind === 'ironMining' || kind === 'copperMining') return planOreMining(world, kind === 'copperMining' ? 'copper' : 'iron')
  let fallback: ExpansionPlan | null = null
  for (const p of chainCandidates(world, kind)) {
    if (kind === 'iron' || kind === 'gears' || kind === 'copper' || kind === 'cables' || kind === 'circuits') {
      const store = world.homestead!.store
      if (store !== null && Math.abs(p.anchor % SIZE - store % SIZE) + Math.abs(Math.floor(p.anchor / SIZE) - Math.floor(store / SIZE)) < 4) continue
      if (p.anchor % SIZE >= SIZE - 2 || [p.anchor + 1, p.anchor + 2].some(t => world.buildings[t] || world.water[t] || world.tiles[t])) continue
      if (!expansionLayout(p).every(s => world.tiles[s.tile] === null) || protectsOutput(world, [p.anchor + 1, p.anchor + 2])) continue
      if (kind === 'circuits') {
        const inlet = p.anchor - 1
        if (world.buildings[inlet] || world.water[inlet] || world.tiles[inlet] || protectsOutput(world, [inlet])) continue
      }
    }
    if (protectsOutput(world, expansionLayout(p).map(s => s.tile)) || !freeSite(world, expansionLayout(p).map(s => s.tile))) continue
    fallback ??= p
    if (!['cables', 'circuits'].includes(kind) || assemblySiteConnected(world, p)) return p
  }
  return fallback
}
// Check the concrete shared yard before committing a new ingredient machine. Nothing is built here.
function assemblySiteConnected(world: World, plan: ExpansionPlan): boolean {
  const h = world.homestead!, buildings = [...world.buildings]
  for (const part of expansionLayout(plan)) {
    const position = { x: part.tile % SIZE, y: Math.floor(part.tile / SIZE) }
    if (part.kind === 'assembler') buildings[part.tile] = { ...position, kind: 'assembler', direction: 'east', recipeMode: 'manual', recipeId: plan.kind === 'circuits' ? 'peteCircuit' : 'copperCable', recipeLocked: true, autoWaitElapsedMs: null, input: emptyInventory(), output: emptyInventory(), job: null }
    else if (part.kind === 'powerPole' || part.kind === 'generator') buildings[part.tile] = { ...position, kind: part.kind }
  }
  let candidate: World = { ...world, buildings, homestead: { ...h, expansion: { ...h.expansion, ...(plan.kind === 'circuits' ? { circuitAssembler: plan.anchor } : { cableAssembler: plan.anchor }) } } }
  if (plan.kind === 'cables' && h.expansion.copperMiner === null && !planOreMining(candidate, 'copper')) return false
  const returns = plan.kind === 'circuits' && h.expansion.furnace !== null ? ['circuitReturn', 'cableReturn', 'copper'] as const : ['copper', 'cableReturn', 'circuitReturn'] as const
  for (const kind of ['iron', 'gearFeed', 'cableFeed', 'circuitFeed', ...returns] as const) {
    if (candidate.homestead!.infrastructure.links.some(p => p.kind === kind) || plan.kind === 'cables' && (kind === 'circuitFeed' || kind === 'circuitReturn')) continue
    if (kind === 'iron' && h.expansion.furnace === null || kind === 'gearFeed' && h.expansion.gearAssembler === null) continue
    const link = planConnection(candidate, kind)
    if (!link) return false
    candidate = previewConnection(candidate, link)
  }
  return true
}
function planOreMining(world: World, resource: 'iron' | 'copper'): ExpansionPlan | null {
  const furnace = resource === 'copper' ? world.homestead!.expansion.copperFurnace : world.homestead!.expansion.furnace
  if (furnace === null || world.buildings[furnace]?.kind !== 'furnace' || furnace % SIZE === 0) return null
  const end = { x: furnace % SIZE - 1, y: Math.floor(furnace / SIZE) }
  const home = world.peace.home!
  const sites = world.tiles.flatMap((ore, tile) => ore === resource && !world.buildings[tile] && !world.water[tile] && Math.max(Math.abs(tile % SIZE - home % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(home / SIZE))) <= 11 ? [tile] : [])
  sites.sort((a, b) => Math.abs(a % SIZE - end.x) + Math.abs(Math.floor(a / SIZE) - end.y) - Math.abs(b % SIZE - end.x) - Math.abs(Math.floor(b / SIZE) - end.y) || a - b)
  for (const anchor of sites) {
    const result = findBeltRoute({ x: anchor % SIZE, y: Math.floor(anchor / SIZE) }, end, 'east', (x, y) => !world.buildings[y * SIZE + x] && !world.water[y * SIZE + x], 400)
    if (!result.points || result.points.length < 2 || result.points.length > 13) continue
    const route = result.points.map(p => p.y * SIZE + p.x)
    for (const direction of ['north', 'south'] as const) {
      const plan: ExpansionPlan = { kind: resource === 'copper' ? 'copperMining' : 'ironMining', anchor, direction, built: 0, route }
      const tiles = expansionLayout(plan).map(s => s.tile)
      if (new Set(tiles).size === tiles.length && tiles.every(t => inside(t % SIZE, Math.floor(t / SIZE)) && Math.abs(t % SIZE - anchor % SIZE) <= 13) && freeSite(world, tiles) && expansionLayout(plan).every(part => neighboringTiles(part.tile).some(tile => !tiles.includes(tile) && !world.water[tile] && !world.buildings[tile]))) return plan
    }
  }
  return null
}
function manualCircuitTarget(world: World, recipe: RecipeId | null): number { return recipe === 'peteCircuit' && world.flightProject?.phase !== 'complete' ? 8 : 12 }
function manualCopperReserve(world: World): number { return world.flightProject?.phase === 'complete' && world.homestead!.infrastructure.links.filter(p => copperLink(p.kind)).length < 5 ? 8 : 0 }
function circuitPlateReserve(world: World): number { return world.personality.paths.inventor.level >= 4 && !world.homestead!.infrastructure.links.some(p => p.kind === 'copper') ? 8 : manualCopperReserve(world) }
function chooseCopper(world: World): boolean {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)!
  const level = world.personality.paths.inventor.level
  for (const kind of ['copper', 'cables'] as const) {
    if (level < (kind === 'copper' ? 2 : 3) || (kind === 'copper' ? e.copperFurnace !== null : e.cableAssembler !== null || e.copperFurnace === null)) continue
    if (Object.entries(chainCost(kind)).some(([item, amount]) => store.inventory[item as Item] < amount)) continue
    const plan = planChain(world, kind)
    if (plan) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
  }
  if (level >= 3 && e.cableAssembler !== null && e.copperMiner === null && store.inventory.copperPlate >= 8) {
    const plan = planChain(world, 'copperMining')
    if (plan) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
  }
  if (level >= 3 && e.copperMiner !== null && e.circuitAssembler === null && store.inventory.copperPlate >= 12) {
    const plan = planChain(world, 'circuits')
    if (plan) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
  }
  const circuits = e.circuitAssembler === null ? null : world.buildings[e.circuitAssembler]
  if (circuits?.kind === 'assembler' && store.inventory.electronicCircuit < manualCircuitTarget(world, circuits.recipeId) && store.wood + inventoryTotal(store.inventory) + 2 <= supplyCapacity(store)) {
    if (!connectionRunning(world, 'circuitReturn') && circuits.output.electronicCircuit) { begin(world, 'takeCircuits', e.circuitAssembler); return true }
    const plate = circuits.recipeId === 'peteCircuit' ? Math.max(0, 1 - circuits.input.copperPlate) : 0
    if (!connectionRunning(world, 'circuitFeed') && !circuits.job && (circuits.recipeId === 'peteCircuit' || legacyCircuitIron(world) > 0) && (plate || circuits.input.copperCable < 3) && store.inventory.copperPlate >= (plate ? plate + circuitPlateReserve(world) : 0) && store.inventory.copperCable >= Math.max(0, 3 - circuits.input.copperCable)) { begin(world, 'fetchCircuits', h.store); return true }
  }
  const furnace = e.copperFurnace === null ? null : world.buildings[e.copperFurnace]
  const assembler = e.cableAssembler === null ? null : world.buildings[e.cableAssembler]
  const room = store.wood + inventoryTotal(store.inventory) + 2 <= supplyCapacity(store)
  const cableInvoice = 2 + manualCopperReserve(world)
  if (assembler?.kind === 'assembler' && store.inventory.copperCable < 16) {
    if (!connectionRunning(world, 'cableReturn') && assembler.output.copperCable && room) { begin(world, 'takeCable', e.cableAssembler); return true }
    if (!connectionRunning(world, 'cableFeed') && !assembler.job && !assembler.input.copperPlate && store.inventory.copperPlate >= cableInvoice) { begin(world, 'fetchCable', h.store); return true }
  }
  if (furnace?.kind === 'furnace' && store.inventory.copperPlate < 40) {
    if (!connectionRunning(world, 'copper') && furnace.output.copperPlate && room) { begin(world, 'takeCopper', e.copperFurnace); return true }
    if ((e.copperMiner === null || world.buildings[e.copperMiner]?.kind !== 'miner') && !furnace.job && !furnace.input.copper && store.inventory.copper >= 2) { begin(world, 'fetchCopper', h.store); return true }
  }
  if ((e.copperMiner === null || world.buildings[e.copperMiner]?.kind !== 'miner' || furnace?.kind !== 'furnace') && store.inventory.copper < 24 && store.wood + inventoryTotal(store.inventory) + 3 <= supplyCapacity(store) && (furnace?.kind !== 'furnace' || store.inventory.copperPlate < 40 || level < 3)) {
    const tile = ironSite(world, 'copper')
    if (tile !== null) { begin(world, 'mineCopper', tile); return true }
  }
  return false
}
function advanceCopper(world: World, delta: number): boolean {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)
  if (['fetchCircuits', 'feedCircuits', 'takeCircuits'].includes(h.task ?? '')) {
    if (!store || !arrived(world, h.target, delta)) return true
    const machine = e.circuitAssembler === null ? null : world.buildings[e.circuitAssembler]
    if (machine?.kind !== 'assembler') { if (inventoryTotal(h.carried)) begin(world, 'returnStock', h.store); else finish(world); return true }
    if (h.task === 'fetchCircuits') {
      const plates = machine.recipeId === 'peteCircuit' ? Math.max(0, 1 - machine.input.copperPlate) : 0, cables = Math.max(0, 3 - machine.input.copperCable)
      if (machine.job || !plates && !cables || store.inventory.copperPlate < (plates ? plates + circuitPlateReserve(world) : 0) || store.inventory.copperCable < cables) { finish(world); return true }
      store.inventory.copperPlate -= plates; store.inventory.copperCable -= cables
      h.carried.copperPlate = plates; h.carried.copperCable = cables; begin(world, 'feedCircuits', e.circuitAssembler)
    } else if (h.task === 'feedCircuits') {
      for (const item of ['ironPlate', 'copperPlate', 'copperCable'] as const) while (h.carried[item] && deliverItem(machine, item, 'east')) h.carried[item]--
      if (inventoryTotal(h.carried)) begin(world, 'returnStock', h.store); else finish(world)
    } else {
      const amount = Math.min(2, machine.output.electronicCircuit, Math.max(0, manualCircuitTarget(world, machine.recipeId) - store.inventory.electronicCircuit))
      if (!amount) { finish(world); return true }
      machine.output.electronicCircuit -= amount; h.carried.electronicCircuit = amount
      awardActivity(world.personality, { path: 'inventor', xp: amount * 2 }); begin(world, 'returnStock', h.store)
    }
    return true
  }
  if (!['fetchCopper', 'feedCopper', 'takeCopper', 'fetchCable', 'feedCable', 'takeCable'].includes(h.task ?? '')) return false
  if (!store || !arrived(world, h.target, delta)) return true
  const cable = h.task === 'fetchCable' || h.task === 'feedCable' || h.task === 'takeCable'
  const tile = cable ? e.cableAssembler : e.copperFurnace, machine = tile === null ? null : world.buildings[tile]
  const input = cable ? 'copperPlate' : 'copper', output = cable ? 'copperCable' : 'copperPlate'
  if (machine?.kind !== (cable ? 'assembler' : 'furnace')) {
    if (inventoryTotal(h.carried)) begin(world, 'returnStock', h.store)
    else finish(world)
    return true
  }
  if (machine.kind !== 'assembler' && machine.kind !== 'furnace') return true
  if (h.task === 'fetchCopper' || h.task === 'fetchCable') {
    if (store.inventory[input] < 2) { finish(world); return true }
    store.inventory[input] -= 2; h.carried[input] = 2
    begin(world, cable ? 'feedCable' : 'feedCopper', tile)
  } else if (h.task === 'feedCopper' || h.task === 'feedCable') {
    while (h.carried[input] && deliverItem(machine, input, 'east')) h.carried[input]--
    if (h.carried[input]) begin(world, 'returnStock', h.store)
    else finish(world)
  } else {
    const amount = Math.min(2, machine.output[output])
    if (!amount) { finish(world); return true }
    machine.output[output] -= amount; h.carried[output] = amount
    awardActivity(world.personality, { path: 'inventor', xp: amount }); begin(world, 'returnStock', h.store)
  }
  return true
}
function clearChainSite(world: World, kind: 'forestry' | 'crates'): boolean {
  for (const plan of chainCandidates(world, kind)) {
    const tiles = expansionLayout(plan).map(s => s.tile), buildings = [...world.buildings]
    for (const tile of tiles) { const b = buildings[tile]; if (b?.kind === 'tree' && treeStage(world, b) === 'mature') buildings[tile] = null }
    if (!freeSite({ ...world, buildings, harvestProject: undefined }, tiles)) continue
    const project = planHarvest(world, tiles)
    if (!project) continue
    world.harvestProject = project; project.selected = true
    Object.assign(world.peace, { activity: 'project', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
    return true
  }
  return false
}
export function chooseExpansion(world: World, path: PersonalityPath = 'craftsman'): boolean {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)
  if (!store) {
    const tile = ironSite(world, path === 'industrial' ? 'coal' : path === 'inventor' ? 'copper' : 'iron')
    if (!h.carried.wood && tile !== null) { begin(world, path === 'industrial' ? 'mineCoal' : path === 'inventor' ? 'mineCopper' : 'mineIron', tile); return true }
    return false
  }
  if (e.plan) { begin(world, 'buildChain', h.store); return true }
  const eco = world.personality.paths.eco.level, craftsman = world.personality.paths.craftsman.level
  // Take turns across the offered paths; each commitment yields to daily life afterwards.
  if (path === 'craftsman' && craftsman >= 2 && e.furnace === null && store.inventory.iron >= 6) {
    const plan = planChain(world, 'iron')
    if (plan) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
  }
  if (path === 'eco' && eco >= 3 && store.storeTier !== 0) for (const id of IMPROVEMENTS) {
    if (e.improvements[id] !== undefined || ((id === 'storeShelves' || id === 'gardenBoxes') && eco < 4)) continue
    const tile = improvementSite(world, id), rule = IMPROVEMENT_RULES[id]
    if (tile !== null && store.inventory[rule.item] >= rule.amount) { e.improvement = id; begin(world, 'improve', h.store); return true }
  }
  if (path === 'eco' && eco >= 4 && h.millBuilt === 3 && store.storeTier !== 0) for (const kind of ['forestry', 'crates'] as const) {
    if (kind === 'crates' && e.forestry === null) continue
    if ((kind === 'forestry' ? e.forestry : e.assembler) !== null || Object.entries(chainCost(kind)).some(([item, amount]) => (item === 'wood' ? store.wood : store.inventory[item as Item]) < amount)) continue
    const plan = planChain(world, kind)
    if (plan) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
    if (clearChainSite(world, kind)) return true
  }
  if (path === 'craftsman' && craftsman >= 3 && e.furnace !== null && e.miner === null && store.inventory.ironPlate >= 8) {
    const plan = planChain(world, 'ironMining')
    if (plan) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
  }
  if (path === 'craftsman' && chooseCraftsman(world)) return true
  if (path === 'inventor') return chooseCopper(world)
  if (path === 'industrial') return chooseIndustrial(world)
  const furnace = e.furnace === null ? null : world.buildings[e.furnace]
  if (path === 'craftsman' && furnace?.kind === 'furnace' && store.inventory.ironPlate < 40) {
    if (!connectionRunning(world, 'iron') && furnace.output.ironPlate && store.wood + inventoryTotal(store.inventory) + 2 <= supplyCapacity(store)) { begin(world, 'takeIron', e.furnace); return true }
    if (!furnace.job && !furnace.input.iron && store.inventory.iron >= 2) { begin(world, 'fetchIron', h.store); return true }
  }
  const assembler = e.assembler === null ? null : world.buildings[e.assembler]
  if (path === 'eco' && !connectionRunning(world, 'crateReturn') && assembler?.kind === 'assembler' && assembler.output.woodenCrate && store.inventory.woodenCrate < 8 && store.wood + inventoryTotal(store.inventory) + 2 <= supplyCapacity(store)) { begin(world, 'takeCrates', e.assembler); return true }
  if (path === 'craftsman' && (e.miner === null || world.buildings[e.miner]?.kind !== 'miner' || furnace?.kind !== 'furnace') && store.inventory.iron < 24 && store.wood + inventoryTotal(store.inventory) + 3 <= supplyCapacity(store) && (furnace?.kind !== 'furnace' || store.inventory.ironPlate < 40)) {
    const tile = ironSite(world)
    if (tile !== null) { begin(world, 'mineIron', tile); return true }
  }
  return false
}
export function advanceExpansion(world: World, delta: number): boolean {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)
  if (advanceCraftsman(world, delta)) return true
  if (advanceIndustrial(world, delta)) return true
  if (h.task === 'mineIron' || h.task === 'mineCopper' || h.task === 'mineCoal') {
    const ore = h.task === 'mineCoal' ? 'coal' : h.task === 'mineCopper' ? 'copper' : 'iron'
    if (h.target === null || world.tiles[h.target] !== ore || world.water[h.target] || world.buildings[h.target]) { h.elapsedMs = 0; const tile = ironSite(world, ore); if (tile === null) { if (inventoryTotal(h.carried) && store) begin(world, 'returnStock', h.store); else if (!inventoryTotal(h.carried)) finish(world); return true } h.target = tile }
    if (!arrived(world, h.target, delta)) return true
    h.elapsedMs = Math.min(6000, h.elapsedMs + delta)
    if (h.elapsedMs === 6000) {
      h.carried[ore] += 3; world.mined[ore] += 3; recordProduction(world, { [ore]: 3 }); h.elapsedMs = 0
      if (store) begin(world, 'returnStock', h.store)
      else if (h.carried[ore] >= 6) { h.task = 'gather'; h.target = null } // Bootstrap chooses a paid store site next.
    }
    return true
  }
  if (h.task === 'fetchSteam' || h.task === 'feedSteam') {
    if (!store || !arrived(world, h.target, delta)) return true
    const engine = e.steamEngine === null ? null : world.buildings[e.steamEngine]
    if (engine?.kind !== 'steamEngine') { if (inventoryTotal(h.carried)) begin(world, 'returnStock', h.store); else finish(world); return true }
    if (h.task === 'fetchSteam') {
      const fuel = store.inventory.coalBriquette >= 2 ? 'coalBriquette' : 'coal'
      if (store.inventory[fuel] < 2) { finish(world); return true }
      store.inventory[fuel] -= 2; h.carried[fuel] = 2; begin(world, 'feedSteam', e.steamEngine)
    } else {
      for (const fuel of ['coalBriquette', 'coal'] as const) while (h.carried[fuel] && deliverItem(engine, fuel, 'east')) h.carried[fuel]--
      if (inventoryTotal(h.carried)) begin(world, 'returnStock', h.store); else finish(world)
    }
    return true
  }
  if (advanceCopper(world, delta)) return true
  if (!['buildChain', 'improve', 'fetchIron', 'feedIron', 'takeIron', 'takeCrates'].includes(h.task ?? '')) return false
  if (!store) return true
  if (h.task === 'buildChain') {
    const plan = e.plan
    if (!plan) return true
    const cost = Object.entries(chainCost(plan.kind)) as [Item, number][]
    if (!inventoryTotal(h.carried)) {
      if (!arrived(world, h.store, delta) || cost.some(([item, amount]) => (item === 'wood' ? store.wood : store.inventory[item]) < amount)) return true
      for (const [item, amount] of cost) { if (item === 'wood') store.wood -= amount; else store.inventory[item] -= amount; h.carried[item] = amount }
    }
    const step = expansionLayout(plan)[plan.built]
    if (!step || world.buildings[step.tile] || world.water[step.tile] || !arrived(world, step.tile, delta, true) || !freeSite(world, [step.tile])) return true
    h.target = step.tile; h.elapsedMs = Math.min(4000, h.elapsedMs + delta)
    if (h.elapsedMs === 4000 && plan.kind === 'coalFeed' && !world.research.unlocked.includes('logistics1')) world.research.unlocked.push('logistics1')
    if (h.elapsedMs !== 4000 || !placeBuilding(world, step.tile % SIZE, Math.floor(step.tile / SIZE), step.kind, step.direction)) return true
    if (step.kind === 'assembler') changeCraftingRecipe(world, step.tile % SIZE, Math.floor(step.tile / SIZE), plan.kind === 'gears' ? 'ironGear' : plan.kind === 'briquettes' ? 'coalBriquette' : plan.kind === 'circuits' ? 'peteCircuit' : plan.kind === 'cables' ? 'copperCable' : 'woodenCrate')
    plan.built++; h.elapsedMs = 0
    if (plan.built === expansionLayout(plan).length) {
      const leftover = emptyInventory()
      if (plan.kind === 'forestry') {
        e.forestry = plan.anchor
        const station = world.buildings[plan.anchor]
        if (station?.kind === 'forester') {
          // Preserve output gathered while a later build step was blocked.
          if (station.output.wood < 6) station.output.wood++
          else leftover.wood = 1
          const plot = forestTiles(station).find(i => !world.tiles[i] && freeSite(world, [i]))
          if (plot !== undefined && !station.plots.includes(plot) && station.plots.length < 48) station.plots.push(plot)
        }
      }
      else if (plan.kind === 'crates') e.assembler = plan.anchor
      else if (plan.kind === 'iron') e.furnace = plan.anchor
      else if (plan.kind === 'ironMining') e.miner = plan.anchor
      else if (plan.kind === 'copper') e.copperFurnace = plan.anchor
      else if (plan.kind === 'copperMining') e.copperMiner = plan.anchor
      else if (plan.kind === 'steam') { e.steamEngine = plan.anchor; const engine = world.buildings[plan.anchor]; if (engine?.kind === 'steamEngine') engine.fuel = 6 }
      else if (plan.kind === 'coalMining') { e.coalMiner = plan.anchor; e.fuelStore = plan.route!.at(-1)! }
      else if (plan.kind === 'coalFeed') e.coalInserter = plan.anchor
      else if (plan.kind === 'briquettes') e.briquetteAssembler = plan.anchor
      else if (plan.kind === 'steamWorkshop' || plan.kind === 'steamHoist') e[plan.kind] = plan.anchor
      else if (plan.kind === 'circuits') e.circuitAssembler = plan.anchor
      else if (plan.kind === 'gears') e.gearAssembler = plan.anchor
      else e.cableAssembler = plan.anchor
      if (INDUSTRIAL_CHAINS.some(k => k === plan.kind)) leftover.coal = h.carried.coal
      h.carried = leftover; awardActivity(world.personality, { path: plan.kind === 'steam' || INDUSTRIAL_CHAINS.some(k => k === plan.kind) ? 'industrial' : plan.kind === 'gears' || plan.kind === 'iron' || plan.kind === 'ironMining' ? 'craftsman' : plan.kind === 'copper' || plan.kind === 'cables' || plan.kind === 'copperMining' || plan.kind === 'circuits' ? 'inventor' : 'eco', xp: 12 }); e.plan = null
      if (inventoryTotal(leftover)) begin(world, INDUSTRIAL_CHAINS.some(k => k === plan.kind) ? 'storeFuel' : 'returnStock', INDUSTRIAL_CHAINS.some(k => k === plan.kind) ? e.fuelStore ?? h.store : h.store)
      else finish(world)
    }
    return true
  }
  if (h.task === 'improve') {
    const id = e.improvement
    if (!id) return true
    const rule = IMPROVEMENT_RULES[id], tile = improvementSite(world, id)
    if (!inventoryTotal(h.carried)) {
      if (!arrived(world, h.store, delta) || store.inventory[rule.item] < rule.amount) return true
      store.inventory[rule.item] -= rule.amount; h.carried[rule.item] = rule.amount
    }
    if (tile === null || !arrived(world, tile, delta)) return true
    h.target = tile; h.elapsedMs = Math.min(8000, h.elapsedMs + delta)
    if (h.elapsedMs === 8000) {
      e.improvements[id] = tile
      if (id === 'storeShelves') store.storeTier = 2
      h.carried = emptyInventory(); e.improvement = null; awardHomesteadOnce(world, `improvement:${id}`, { path: 'eco', xp: rule.xp }); finish(world)
    }
    return true
  }
  if (!arrived(world, h.target, delta)) return true
  const furnace = e.furnace === null ? null : world.buildings[e.furnace], assembler = e.assembler === null ? null : world.buildings[e.assembler]
  if (h.task === 'fetchIron') {
    if (store.inventory.iron < 2 || furnace?.kind !== 'furnace') { finish(world); return true }
    store.inventory.iron -= 2; h.carried.iron = 2; begin(world, 'feedIron', e.furnace)
  } else if (h.task === 'feedIron') {
    if (furnace?.kind !== 'furnace') { begin(world, 'returnStock', h.store); return true }
    while (h.carried.iron && deliverItem(furnace, 'iron', 'east')) h.carried.iron--
    if (!h.carried.iron) finish(world)
    else begin(world, 'returnStock', h.store)
  } else {
    const machine = h.task === 'takeIron' ? furnace : assembler, item = h.task === 'takeIron' ? 'ironPlate' : 'woodenCrate'
    if ((machine?.kind !== 'furnace' && machine?.kind !== 'assembler') || !machine.output[item]) { finish(world); return true }
    const amount = Math.min(2, machine.output[item]); machine.output[item] -= amount; h.carried[item] = amount
    if (h.task === 'takeIron') awardActivity(world.personality, { path: 'craftsman', xp: amount })
    begin(world, 'returnStock', h.store)
  }
  return true
}
export function expansionSummary(world: World): string {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)
  if (h.task === 'buildChain' && e.plan) {
    const step = expansionLayout(e.plan)[e.plan.built]
    if (step && (world.buildings[step.tile] || world.water[step.tile] || miniApproach(world, step.tile) === null)) return 'Mein nächster Bauplatz oder Weg ist blockiert. Bezahltes Material und Baufortschritt bleiben erhalten.'
    return `Ich baue ${e.plan.kind === 'forestry' ? 'Forststation und Förderband' : e.plan.kind === 'crates' ? 'den Assembler für Holzkisten' : e.plan.kind === 'gears' ? 'meinen Zahnrad-Assembler' : e.plan.kind === 'coalMining' ? 'den Kohleförderer mit Brennstofflager und Stromverbindung' : e.plan.kind === 'coalFeed' ? 'den Kesselgreifer' : e.plan.kind === 'briquettes' ? 'den Kohlestampfer' : e.plan.kind === 'steamWorkshop' ? 'meine Dampfwerkstatt' : e.plan.kind === 'steamHoist' ? 'meinen Förderaufzug' : e.plan.kind === 'steam' ? 'meinen kohlebefeuerten Dampfantrieb' : e.plan.kind === 'copperMining' ? 'Kupferförderer und Förderband zum Kupferofen' : e.plan.kind === 'ironMining' ? 'Erzförderer und Förderband zum Eisenofen' : e.plan.kind === 'copper' ? 'meinen Kupferofen' : e.plan.kind === 'circuits' ? 'den Schaltkreis-Assembler' : e.plan.kind === 'cables' ? 'den Kabel-Assembler' : 'meinen Eisenofen'} · ${e.plan.built}/${expansionLayout(e.plan).length}. Bezahltes Material bleibt erhalten.`
  }
  if (h.task === 'improve' && e.improvement) return improvementSite(world, e.improvement) === null ? 'Das Gebäude für meine Verbesserung fehlt. Ich behalte das bereits abgeholte Material.' : `Ich baue: ${IMPROVEMENT_RULES[e.improvement].label}.`
  const missing = IMPROVEMENTS.find(id => e.improvements[id] === undefined && improvementSite(world, id) !== null)
  const rule = missing ? IMPROVEMENT_RULES[missing] : null
  return `${rule ? `${rule.label}: ${store?.inventory[rule.item] ?? 0}/${rule.amount} ${rule.item === 'woodPanel' ? 'Holzplatten' : 'Holzkisten'}. ` : ''}Forststation und Holzkisten ab Öko 4 mit freiem Bauplatz am Sägewerk. Eisenabbau ab Stufe 1, Schmelzofen ab Handwerker 2, Erzförderer ab 3 (8 Eisenplatten). Kupferofen ab Erfinder 2 (6 Erz), Kabel-Assembler ab 3 (8 Kupferplatten), Kupferförderer ab 3 (8 Platten), Schaltkreis-Assembler danach (12 Platten). Schaltkreise brauchen echte Eisenplatten und je 3 Kupferkabel; Flugwerkstatt ab 4, Rundflüge ab 5. Mehr passende Vorräte und nahe Ressourcen erhöhen meine Projektchancen.`
}
export function expansionProjectStatuses(world: World): { path: PersonalityPath; name: string; reason: string }[] {
  const h = world.homestead
  if (!h) return []
  const store = materialStore(world)
  const improvements = IMPROVEMENTS.map(id => {
    const rule = IMPROVEMENT_RULES[id]
    return { path: 'eco' as const, name: rule.label, reason: h.expansion.improvements[id] !== undefined ? 'fertig' : `${store?.inventory[rule.item] ?? 0}/${rule.amount} ${rule.item === 'woodPanel' ? 'Holzplatten' : 'Holzkisten'}${improvementSite(world, id) === null ? ' · zuerst das Grundprojekt bauen' : ''}` }
  })
  const e = h.expansion
  const entry = (path: PersonalityPath, name: string, reason: string) => ({ path, name, reason })
  return [...improvements,
    entry('eco', 'Sägewerk', h.millBuilt === 3 ? 'gebaut' : `${store?.wood ?? 0}/12 Holz · Eco 3 · freier Bauplatz mit Stromversorgung`),
    entry('eco', 'Forststation', e.forestry !== null ? 'gebaut' : `${store?.inventory.woodPanel ?? 0}/8 Holzplatten und ${store?.wood ?? 0}/1 Holz · Eco 4 · zuerst Sägewerk und Lagerdach`),
    entry('eco', 'Kisten-Assembler', e.assembler !== null ? 'gebaut' : `${store?.inventory.woodPanel ?? 0}/12 Holzplatten · Eco 4 · zuerst Forststation`),
    entry('craftsman', 'Eisenofen', e.furnace !== null ? 'gebaut' : `${store?.inventory.iron ?? 0}/6 Eisenerz · Craftsman 2 · freier Bauplatz mit Stromversorgung`),
    entry('craftsman', 'Ambossübung', 'Wiederkehrend an der fertigen Werkstatt: 5 Sekunden Arbeit, 60 Sekunden Pause; ab Craftsman 3 je 5 XP. Auch das Abholen echter Eisenplatten bringt XP.'),
    entry('craftsman', 'Zahnrad-Assembler', e.gearAssembler !== null ? 'gebaut' : `${store?.inventory.ironPlate ?? 0}/8 Eisenplatten · Craftsman 3 · zuerst Erzförderer`),
    entry('craftsman', 'Lastenfahrrad', h.cargoBicycle ? 'ausgebaut · doppelte Fahrtgeschwindigkeit auf Materialrouten' : `${store?.inventory.ironPlate ?? 0}/12 Eisenplatten und ${store?.inventory.ironGear ?? 0}/6 Zahnräder · Craftsman 4 · vorhandenes Fahrrad`),
    entry('craftsman', 'Erzförderer', `${e.miner !== null ? 'gebaut' : `${store?.inventory.ironPlate ?? 0}/8 Eisenplatten · Handwerker 3 · freie Bandstrecke mit höchstens 12 Feldern zum Eisenofen`}`),
    entry('inventor', 'Kupferofen', `${e.copperFurnace !== null ? 'gebaut' : `${store?.inventory.copper ?? 0}/6 Kupfererz · Erfinder 2 · freier Bauplatz mit Stromversorgung`}`),
    entry('inventor', 'Kupferförderer', `${e.copperMiner !== null ? 'gebaut' : `${store?.inventory.copperPlate ?? 0}/8 Kupferplatten · Erfinder 3 · zuerst Kabel-Assembler · freie Bandstrecke zum Kupferofen`}`),
    entry('inventor', 'Schaltkreis-Assembler', `${e.circuitAssembler !== null ? 'gebaut' : `${store?.inventory.copperPlate ?? 0}/12 Kupferplatten · Erfinder 3 · zuerst Kupferförderer · freier Bauplatz`}`),
    entry('inventor', 'Schaltkreis-Zutaten', `${store?.inventory.copperPlate ?? 0}/1 Kupferplatte und ${store?.inventory.copperCable ?? 0}/3 Kupferkabel pro Stück · Material muss erreichbar sein`),
    entry('inventor', 'Flugwerkstatt', `Erfinder 4 · vorhandene Schaltkreise und Kupferkabel · Übungsflüge führen zu Rundflügen ab 5`),
    entry('industrial', 'Kohleförderung', `${e.coalMiner !== null ? 'gebaut' : 'Industrie 3 · 6 Kohle als Vorrat · freie Bandstrecke zum Brennstofflager am Kessel'}`),
    entry('industrial', 'Kesselgreifer', `${e.coalInserter !== null ? 'gebaut' : 'zuerst Kohleförderung · 6 Kohle als Brennstoffreserve · freier Platz zwischen Lager und Kessel'}`),
    entry('industrial', 'Kohlestampfer', `${e.briquetteAssembler !== null ? 'gebaut' : 'Industrie 3 · zuerst Kesselgreifer · 6 Kohle Vorrat'} · 2 Kohle → 1 Brikett · 60 kW · 4 Sekunden bei voller Leistung`),
    entry('industrial', 'Dampfwerkstatt', `${e.steamWorkshop !== null ? 'gebaut' : `Industrie 4 · ${Math.min(4, world.produced.coalBriquette)}/4 gefertigte Briketts · 6 Kohle Vorrat`} · tatsächliche Dampfenergie nötig`),
    entry('industrial', 'Förderaufzug', `${e.steamHoist !== null ? 'gebaut' : 'Industrie 5 · 10 Arbeitszyklen der Dampfwerkstatt · 6 Kohle Vorrat'} · Zugänge und Stromverbindung freihalten`),
    entry('industrial', 'Dampfantrieb', `${e.steamEngine !== null ? 'gebaut' : `${store?.inventory.coal ?? 0}/6 Kohle · Industrie 2 · freier Bauplatz`}; danach 2 Kohle je persönlicher Lieferung, 1 Kohle je 10 Sekunden Arbeit · geschlossener Wasserkreislauf`),
    entry('inventor', 'Kabel-Assembler', `${e.cableAssembler !== null ? 'gebaut' : `${store?.inventory.copperPlate ?? 0}/8 Kupferplatten · Erfinder 3 · zuerst Kupferofen · freier Bauplatz`}`),
  ]
}
export function expansionProjects(world: World): string[] {
  return expansionProjectStatuses(world).map(project => `${project.name}: ${project.reason}`)
}
