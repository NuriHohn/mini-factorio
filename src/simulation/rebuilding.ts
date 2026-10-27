import { INDUSTRIAL_CHAINS } from './industrialRules'
import { findBeltRoute } from './beltRouting'
import { recordProduction } from './analytics'
import { changeCraftingRecipe } from './crafting'
import { arrived, freeSite, handMillLayout, materialStore } from './homestead'
import { chainCost, expansionLayout, IMPROVEMENTS } from './homesteadExpansion'
import type { ExpansionPlan } from './homesteadExpansion'
import { emptyInventory, inventoryTotal, ITEMS } from './items'
import type { Inventory, Item } from './items'
import { chopTree, refreshNatureSchedule, treeStage } from './nature'
import { awardActivity } from './personality'
import type { ProjectReward } from './personality'
import { miniApproach, miniLayout } from './petesWorld'
import { PETE_PROJECTS } from './projectRegistry'
import { projectBuilding } from './secretProject'
import { invalidateTerrain } from './waterTerrain'
import { buildingAt, inside, placeBuilding, SIZE } from './world'
import type { BuildingKind, Direction, World } from './world'

export type RebuildOwner = { type: 'project'; id: ProjectReward } | { type: 'chain'; plan: ExpansionPlan } | { type: 'home' } | { type: 'store' } | { type: 'mill' } | { type: 'prototype' }
export interface RebuildJob { tile: number; owner: RebuildOwner; paid: Inventory; funded: boolean; elapsedMs: number; gather: number | null }
export interface Rebuilding { jobs: RebuildJob[]; active: number | null; rewarded: string[] }
export function ensureRebuilding(world: World): Rebuilding {
  if (world.rebuilding) return world.rebuilding
  const h = world.homestead
  const rewarded = h ? [ ...(h.store !== null ? ['store'] : []), ...(h.millBuilt === 3 ? ['mill'] : []), ...(materialStore(world)?.storeTier ? ['roof'] : []), ...Object.keys(h.expansion.improvements).map(id => `improvement:${id}`), ...(['gearAssembler', 'forestry', 'assembler', 'furnace', 'miner', 'copperFurnace', 'cableAssembler', 'copperMiner', 'circuitAssembler', 'steamEngine', 'coalMiner', 'coalInserter', 'briquetteAssembler', 'steamWorkshop', 'steamHoist'] as const).filter(key => h.expansion[key] !== null).map(key => `chain:${key}`) ] : []
  return world.rebuilding = { jobs: [], active: null, rewarded }
}
export function awardHomesteadOnce(world: World, id: string, reward: Parameters<typeof awardActivity>[1]): void {
  if (world.rebuilding) {
    if (world.rebuilding.rewarded.includes(id)) return
    world.rebuilding.rewarded.push(id)
  }
  awardActivity(world.personality, reward)
}
function existingChain(world: World, kind: ExpansionPlan['kind'], anchor: number): ExpansionPlan {
  if (kind === 'coalFeed') { const e = world.homestead!.expansion, delta = e.steamEngine! - e.fuelStore!; return { kind, anchor, direction: delta === 2 ? 'east' : delta === -2 ? 'west' : delta > 0 ? 'south' : 'north', built: 0 } }
  if (kind === 'forestry') {
    const b = world.buildings[anchor]
    return { kind, anchor, direction: b && 'direction' in b ? b.direction : 'east', built: 0 }
  }
  const candidates: ExpansionPlan[] = (['north', 'south'] as const).map(direction => ({ kind, anchor, direction, built: 0 }))
  if (kind === 'ironMining' || kind === 'copperMining' || kind === 'coalMining') {
    const route = [anchor], end = kind === 'coalMining' ? world.homestead!.expansion.fuelStore! : (kind === 'copperMining' ? world.homestead!.expansion.copperFurnace! : world.homestead!.expansion.furnace!) - 1
    while (route.length < 13 && route.at(-1) !== end) {
      const tile = route.at(-1)!, b = world.buildings[tile]
      if (!b || !('direction' in b)) break
      const next = tile + (b.direction === 'east' ? 1 : b.direction === 'west' ? -1 : b.direction === 'north' ? -SIZE : SIZE)
      if (route.includes(next) || next < 0 || next >= SIZE * SIZE) break
      route.push(next)
    }
    if (route.at(-1) !== end) {
      const result = findBeltRoute({ x: anchor % SIZE, y: Math.floor(anchor / SIZE) }, { x: end % SIZE, y: Math.floor(end / SIZE) }, 'east', (x, y) => { const tile = y * SIZE + x; return !world.water[tile] && (tile === anchor || kind === 'coalMining' && tile === end || !world.buildings[tile] || world.buildings[tile]?.kind === 'belt') }, 400, (x, y) => world.buildings[y * SIZE + x]?.kind === 'belt')
      if (result.points && result.points.length <= 13) route.splice(0, route.length, ...result.points.map(p => p.y * SIZE + p.x))
    }
    for (const p of candidates) p.route = route
  }
  return candidates.sort((a, b) => expansionLayout(b).filter(s => world.buildings[s.tile]?.kind === s.kind).length - expansionLayout(a).filter(s => world.buildings[s.tile]?.kind === s.kind).length)[0]
}
function owners(world: World): RebuildOwner[] {
  const h = world.homestead
  const result: RebuildOwner[] = [{ type: 'home' }, { type: 'store' }, { type: 'mill' }, ...PETE_PROJECTS.filter(d => !d.repeatable && d.id !== 'veranda').map(d => ({ type: 'project' as const, id: d.id as ProjectReward }))]
  if (h) {
    for (const job of world.rebuilding?.jobs ?? []) if (job.owner.type === 'chain') result.push(job.owner)
    if (h.expansion.plan) result.push({ type: 'chain', plan: structuredClone(h.expansion.plan) })
    for (const [kind, key] of [['gears', 'gearAssembler'], ['forestry', 'forestry'], ['crates', 'assembler'], ['iron', 'furnace'], ['ironMining', 'miner'], ['copper', 'copperFurnace'], ['cables', 'cableAssembler'], ['copperMining', 'copperMiner'], ['circuits', 'circuitAssembler'], ['steam', 'steamEngine'], ['coalMining', 'coalMiner'], ['coalFeed', 'coalInserter'], ['briquettes', 'briquetteAssembler'], ['steamWorkshop', 'steamWorkshop'], ['steamHoist', 'steamHoist']] as const) {
      const anchor = h.expansion[key]
      if (anchor !== null) result.push({ type: 'chain', plan: existingChain(world, kind, anchor) })
    }
  }
  if (world.miniFactory && world.miniFactory.anchor !== null) result.push({ type: 'prototype' })
  return result
}
export function rebuildParts(world: World, owner: RebuildOwner): { tile: number; kind: BuildingKind; direction: Direction }[] {
  const h = world.homestead
  if (owner.type === 'home') return world.peace.home === null ? [] : [{ tile: world.peace.home, kind: 'treehouse', direction: 'east' }]
  if (owner.type === 'store') return h?.store === null || h?.store === undefined ? [] : [{ tile: h.store, kind: 'supplyCrate', direction: 'east' }]
  if (owner.type === 'mill') return h?.millAnchor === null || h?.millAnchor === undefined ? [] : handMillLayout(h.millAnchor).slice(0, h.millBuilt).map(s => ({ ...s, direction: 'east' }))
  if (owner.type === 'prototype') return world.miniFactory?.anchor === null || world.miniFactory?.anchor === undefined ? [] : miniLayout(world.miniFactory.anchor).slice(0, world.miniFactory.built).map(s => ({ ...s, direction: 'east' }))
  if (owner.type === 'chain') return expansionLayout(owner.plan)
  const definition = PETE_PROJECTS.find(d => d.id === owner.id), project = definition ? world[definition.state] : null
  return project ? project.tiles.slice(0, project.built).map(tile => { const b = projectBuilding(project, tile); return { tile, kind: b.kind, direction: 'direction' in b ? b.direction : 'east' } }) : []
}
export function rebuildCost(_world: World, job: RebuildJob): Inventory {
  const cost = emptyInventory(), owner = job.owner
  if (owner.type === 'home') cost.wood = 20
  else if (owner.type === 'store') cost.wood = 6
  else if (owner.type === 'mill') cost.wood = 4
  else if (owner.type === 'prototype') cost.woodPanel = 2
  else if (owner.type === 'chain') {
    if (INDUSTRIAL_CHAINS.some(k => k === owner.plan.kind)) { if (expansionLayout(owner.plan).find(p => p.tile === job.tile)?.kind === 'fuelDepot') cost.coal = 6; return cost }
    if (owner.plan.kind === 'steam') { if (job.tile === owner.plan.anchor) cost.coal = 6; return cost }
    const count = expansionLayout(owner.plan).length
    for (const [item, amount] of Object.entries(chainCost(owner.plan.kind))) cost[item as Item] = Math.ceil(amount / count)
  } else {
    const d = PETE_PROJECTS.find(d => d.id === owner.id)!
    for (const [item, amount] of Object.entries(d.resources)) if (ITEMS.includes(item as Item)) cost[item as Item] = owner.id === 'fence' ? 2 : amount
  }
  return cost
}
export function rememberDemolition(world: World, tile: number): void {
  if (!world.miniFactory) return
  const b = world.buildings[tile]
  if (!b || b.kind === 'tree') return
  const r = ensureRebuilding(world)
  if (!r.jobs.some(j => j.tile === tile)) {
    const owner = owners(world).find(owner => rebuildParts(world, owner).some(s => s.tile === tile && s.kind === b.kind))
    if (owner) r.jobs.push({ tile, owner, paid: emptyInventory(), funded: false, elapsedMs: 0, gather: null })
  }
  if (b.kind === 'treehouse' && ['entering', 'resting', 'verandaRest'].includes(world.peace.activity)) { world.peace.activity = 'walking'; world.peace.sinceMs = world.timeMs; world.peace.untilMs = world.timeMs; world.peace.destination = null }
  const h = world.homestead
  if (h) for (const id of IMPROVEMENTS) if (h.expansion.improvements[id] === tile) delete h.expansion.improvements[id]
}
export function clearResource(world: World, x: number, y: number): string | null {
  if (!world.miniFactory || !inside(x, y)) return 'Ressourcen entfernen gibt es nur in Petes Welt.'
  const b = buildingAt(world, x, y), tile = y * SIZE + x
  if (b && b.kind !== 'tree') return 'Zuerst das Gebäude ausdrücklich abreißen.'
  const miningPlan = world.homestead?.expansion.plan
  if (world.tiles[tile] && (((miningPlan?.kind === 'ironMining' || miningPlan?.kind === 'copperMining' || miningPlan?.kind === 'coalMining') && miningPlan.anchor === tile) || world.rebuilding?.jobs.some(j => j.owner.type === 'chain' && (j.owner.plan.kind === 'ironMining' || j.owner.plan.kind === 'copperMining' || j.owner.plan.kind === 'coalMining') && j.owner.plan.anchor === tile))) return 'Dieser Erzplatz ist für den bezahlten Minenbau oder Wiederaufbau reserviert. Andere Erzfelder können entfernt werden.'
  if (b?.kind !== 'tree' && !world.tiles[tile]) return 'Wähle einen Baum oder ein Erzfeld.'
  if (b?.kind === 'tree') chopTree(world, x, y, false)
  world.tiles[tile] = null
  for (const station of world.buildings) if (station?.kind === 'forester') station.plots = station.plots.filter(i => i !== tile)
  invalidateTerrain(world, [tile]); refreshNatureSchedule(world)
  return null
}
function safe(world: World, job: RebuildJob): boolean {
  if (rebuildParts(world, job.owner).find(p => p.tile === job.tile)?.kind === 'miner' && !world.tiles[job.tile]) return false
  if (world.buildings[job.tile] || world.water[job.tile]) return false
  const spot = miniApproach(world, job.tile)
  if (spot === null) return false
  // Evaluate access from the eventual work approach, not Pete's in-flight route
  // across the currently empty construction tile. Actual placement waits for arrival.
  const candidate = { ...world, rebuilding: undefined, pete: { ...world.pete, tile: spot, x: spot % SIZE, y: Math.floor(spot / SIZE), next: null, path: [] } }
  return freeSite(candidate, [job.tile])
}

function supplied(world: World, job: RebuildJob): boolean {
  const store = materialStore(world), cost = rebuildCost(world, job)
  return !!store && miniApproach(world, world.homestead!.store!) !== null && ITEMS.every(i => (i === 'wood' ? store.wood : store.inventory[i]) >= cost[i])
}
export function chooseRebuild(world: World): boolean {
  const r = world.rebuilding
  if (!r || r.active !== null) return false
  const job = r.jobs.find(j => safe(world, j) && (j.funded || j.owner.type === 'store' || supplied(world, j)))
  if (!job) return false
  r.active = job.tile
  return true
}
function gatherForStore(world: World, job: RebuildJob, delta: number): boolean {
  if (inventoryTotal(job.paid) >= 6) { job.funded = true; job.elapsedMs = 0; job.gather = null; return true }
  let tile = job.gather
  const valid = (i: number) => job.paid.iron ? world.tiles[i] === 'iron' && !world.buildings[i] : job.paid.copper ? world.tiles[i] === 'copper' && !world.buildings[i] : job.paid.coal ? world.tiles[i] === 'coal' && !world.buildings[i] : job.paid.wood ? world.buildings[i]?.kind === 'tree' && treeStage(world, world.buildings[i]) === 'mature' : world.buildings[i]?.kind === 'tree' && treeStage(world, world.buildings[i]) === 'mature' || !world.buildings[i] && (world.tiles[i] === 'iron' || world.tiles[i] === 'copper' || world.tiles[i] === 'coal')
  if (tile === null || !valid(tile)) {
    tile = world.buildings.map((_, i) => i).find(i => valid(i) && Math.max(Math.abs(i % SIZE - world.peace.home! % SIZE), Math.abs(Math.floor(i / SIZE) - Math.floor(world.peace.home! / SIZE))) <= 11 && miniApproach(world, i) !== null) ?? null
    job.gather = tile; job.elapsedMs = 0
  }
  if (tile === null || !arrived(world, tile, delta)) return false
  job.elapsedMs += delta
  if (job.elapsedMs < 6000) return false
  const b = world.buildings[tile]
  if (b?.kind === 'tree') { const cut = chopTree(world, tile % SIZE, Math.floor(tile / SIZE), false); if (cut) job.paid.wood += cut.wood }
  else { const item = world.tiles[tile]; if (item === 'iron' || item === 'copper' || item === 'coal') { job.paid[item] += 3; world.mined[item] += 3; recordProduction(world, { [item]: 3 }) } }
  job.elapsedMs = 0; job.gather = null
  return false
}
export function advanceRebuilding(world: World, delta: number): boolean {
  const r = world.rebuilding
  if (!r || !world.homestead) return false
  // Losing the store suspends existing work with its paid cargo untouched.
  if (r.active === null && materialStore(world) && world.homestead.task && world.homestead.target !== null && !world.buildings[world.homestead.target]) { const interrupted = r.jobs.find(j => j.tile === world.homestead!.target && safe(world, j) && (j.funded || supplied(world, j))); if (interrupted) r.active = interrupted.tile }
  if (r.active === null && !materialStore(world)) { const storeJob = r.jobs.find(j => j.owner.type === 'store'); if (storeJob) r.active = storeJob.tile }
  if (r.active === null) return false
  const job = r.jobs.find(j => j.tile === r.active)
  if (!job) { r.active = null; return false }
  if (!job.funded) {
    if (job.owner.type === 'store') { if (!gatherForStore(world, job, delta)) { if (job.gather === null && inventoryTotal(job.paid) < 6) { r.active = null; return false }; return true } }
    else {
      if (!supplied(world, job)) { r.active = null; return false }
      const store = materialStore(world)!
      if (!arrived(world, world.homestead.store, delta)) return true
      const cost = rebuildCost(world, job)
      for (const item of ITEMS) { if (item === 'wood') store.wood -= cost[item]; else store.inventory[item] -= cost[item]; job.paid[item] = cost[item] }
      job.funded = true
    }
  }
  if (!safe(world, job)) { r.active = null; return false }
  if (!arrived(world, job.tile, delta, true)) return true
  job.elapsedMs = Math.min(4000, job.elapsedMs + delta)
  if (job.elapsedMs < 4000) return true
  const part = rebuildParts(world, job.owner).find(p => p.tile === job.tile)
  if (!part) { r.active = null; return true }
  const position = { x: job.tile % SIZE, y: Math.floor(job.tile / SIZE) }
  if (job.owner.type === 'project') {
    const owner = job.owner, d = PETE_PROJECTS.find(d => d.id === owner.id)!, project = world[d.state]!
    world.buildings[job.tile] = projectBuilding(project, job.tile); world.topologyRevision++
  } else if (job.owner.type === 'store') { world.buildings[job.tile] = { ...position, kind: 'supplyCrate', inventory: emptyInventory(), wood: 0, storeTier: 0 }; world.topologyRevision++ }
  else if (job.owner.type === 'home') { world.buildings[job.tile] = { ...position, kind: 'treehouse', placedAtMs: 0 }; world.topologyRevision++ }
  else {
    if (!placeBuilding(world, position.x, position.y, part.kind, part.direction)) return true
    if (part.kind === 'steamEngine') { const engine = world.buildings[job.tile]; if (engine?.kind === 'steamEngine') engine.fuel = job.paid.coal }
    if (part.kind === 'fuelDepot') { const depot = world.buildings[job.tile]; if (depot?.kind === 'fuelDepot') depot.inventory.coal = job.paid.coal }
    if (part.kind === 'assembler') changeCraftingRecipe(world, position.x, position.y, job.owner.type === 'chain' && job.owner.plan.kind === 'gears' ? 'ironGear' : job.owner.type === 'chain' && job.owner.plan.kind === 'briquettes' ? 'coalBriquette' : job.owner.type === 'chain' && job.owner.plan.kind === 'circuits' ? 'electronicCircuit' : job.owner.type === 'chain' && job.owner.plan.kind === 'cables' ? 'copperCable' : 'woodenCrate')
  }
  r.jobs = r.jobs.filter(j => j !== job); r.active = null
  // Resume through existing navigation rather than retaining a repair destination.
  world.pete.path = []; world.pete.pathRevision = -1; world.peace.destination = null
  world.peace.activity = 'walking'; world.peace.sinceMs = world.timeMs; world.peace.untilMs = world.timeMs
  return true
}
export function rebuildSummary(world: World): string[] {
  return world.rebuilding?.jobs.map(job => {
    const cost = rebuildCost(world, job)
    return `Wiederaufbau (${job.tile % SIZE}, ${Math.floor(job.tile / SIZE)}): ${job.funded ? 'Material bereits bezahlt' : ITEMS.filter(i => cost[i]).map(i => `${cost[i]} ${i}`).join(' + ')} · ${!safe(world, job) ? 'Bauplatz oder Zugang blockiert.' : job.owner.type === 'store' && !job.funded ? 'Ich sammle sechs passende Rohstoffe direkt aus der Welt.' : !job.funded && !supplied(world, job) ? 'Material fehlt in meinem erreichbaren Lager.' : 'Pete entscheidet selbst, wann er baut.'}`
  }) ?? []
}

// Old saves retain historical completions even if their structures were removed.
export function migrateMissingStructures(world: World): void {
  if (!world.miniFactory || !world.homestead) return
  for (const owner of owners(world)) for (const part of rebuildParts(world, owner)) {
    if (world.buildings[part.tile] || world.rebuilding?.jobs.some(j => j.tile === part.tile)) continue
    ensureRebuilding(world).jobs.push({ tile: part.tile, owner, paid: emptyInventory(), funded: false, elapsedMs: 0, gather: null })
  }
}

export function demolitionNotice(world: World, tile: number): string {
  const b = world.buildings[tile]
  if (!b) return 'Wähle ein Gebäude zum Abreißen.'
  let items = 'inventory' in b ? inventoryTotal(b.inventory) : 0
  if (b.kind === 'steamEngine') items += b.fuel + b.briquettes + Number(b.burnRemainingMs > 0)
  if (b.kind === 'supplyCrate') items += b.wood
  if (b.kind === 'splitter') items += Number(b.input !== null) + b.outputs.filter(Boolean).length
  if (b.kind === 'petePress') items += b.plates + b.gears
  if (b.kind === 'peteDevelopment') items += b.gears + b.modules + b.fruit
  if ('output' in b) items += inventoryTotal(b.output)
  if ('input' in b && b.kind !== 'splitter') items += inventoryTotal(b.input)
  if ('job' in b && b.job) items += inventoryTotal(b.job.inputs)
  if ('item' in b && b.item) items++
  return `Abriss: ${items} enthaltene Materialien gehen verloren. Keine Erstattung. Bereits getragenes Material und Fortschritt bleiben. Pete kann fehlende eigene Teile kostenpflichtig wieder aufbauen.${b.kind === 'peteCoop' ? ' Bodeneier werden entfernt; Hühner warten geschützt bis zum Wiederaufbau.' : ''}`
}
