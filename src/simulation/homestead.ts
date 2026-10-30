import { connectionRunning } from './infrastructure'
import { chooseInfrastructure, advanceInfrastructure, infrastructureReserved } from './infrastructure'
import { createInfrastructure } from './infrastructureRules'
import type { Infrastructure } from './infrastructureRules'
import { chooseShoreline, advanceShoreline } from './shoreline'
import { wantsShoreDock, wantsWaterwheel, wantsEcoReturns } from './projectRegistry'
import type { Waterworks } from './shoreline'
import { cargoBicycleAvailable } from './craftsman'
import { chooseRebuild, awardHomesteadOnce } from './rebuilding'
import { neighboringTiles, peteReachableTiles, peteWalkableTile, tilePath } from './navigation'
import { preferredPaths } from './resourcePreference'
import { emptyInventory, inventoryTotal, ITEMS } from './items'
import { advanceExpansion, chooseExpansion, createExpansion, expansionSummary } from './homesteadExpansion'
import type { HomesteadExpansion } from './homesteadExpansion'
import type { Inventory } from './items'
import { chopTree, treeStage } from './nature'
import { awardActivity } from './personality'
import { miniApproach, miniWalk } from './petesWorld'
import { currentProject, projectPlansConflict } from './secretProject'
import { supplyCapacity } from './supplyCrate'
import { inside, placeBuilding, placementError, SIZE } from './world'
import type { BuildingKind, SupplyCrate, World } from './world'

export const NEW_HOME_TASKS = ['fetchGear', 'feedGear', 'takeGear', 'upgradeBicycle', 'buildBridge', 'buildDock'] as const
export const INFRASTRUCTURE_TASKS = ['parkBicycle', 'buildConnection', 'buildWheel', 'finishOrder'] as const
export const LATER_HOME_TASKS = ['buildLoading', 'fetchLoading', 'feedLoading', 'takeLoading'] as const
export const HOME_TASKS = ['buildPavilion', ...LATER_HOME_TASKS, ...INFRASTRUCTURE_TASKS, ...NEW_HOME_TASKS, 'takeCoal', 'fetchStamp', 'feedStamp', 'takeBriquettes', 'fetchFuel', 'storeFuel', 'gather', 'buildStore', 'buildMill', 'fetchWood', 'feedMill', 'takePanels', 'returnStock', 'expandStore', 'mineIron', 'buildChain', 'improve', 'fetchIron', 'feedIron', 'takeIron', 'takeCrates', 'mineCopper', 'fetchCopper', 'feedCopper', 'takeCopper', 'fetchCable', 'feedCable', 'takeCable', 'fetchCircuits', 'feedCircuits', 'takeCircuits', 'mineCoal', 'fetchSteam', 'feedSteam'] as const
export type HomeTask = typeof HOME_TASKS[number]
export interface Homestead {
  priority: string | null
  nextMealAtMs: number
  store: number | null
  cargoBicycle: boolean
  bikeTile: number | null
  infrastructure: Infrastructure
  waterworks: Waterworks
  task: HomeTask | null
  target: number | null
  treeBornAtMs: number | null
  carried: Inventory
  elapsedMs: number
  nextAtMs: number
  nextRestAtMs: number
  millAnchor: number | null
  millBuilt: number
  expansion: HomesteadExpansion
}
export const HOMESTEAD_REST_INTERVAL_MS = 360000
export function createHomestead(): Homestead {
  return { priority: null, nextMealAtMs: 600000, infrastructure: createInfrastructure(), store: null, cargoBicycle: false, bikeTile: null, waterworks: { plan: null, bridges: [], dock: null, nextVisitAtMs: 0, preferBoat: true }, task: null, target: null, treeBornAtMs: null, carried: emptyInventory(), elapsedMs: 0, nextAtMs: 0, nextRestAtMs: HOMESTEAD_REST_INTERVAL_MS, millAnchor: null, millBuilt: 0, expansion: createExpansion() }
}
export function materialStore(world: World): SupplyCrate | null {
  const tile = world.homestead?.store, b = tile === null || tile === undefined ? null : world.buildings[tile]
  return b?.kind === 'supplyCrate' && b.storeTier !== undefined ? b : null
}
// Older expansion plans could seal Pete in a tiny pocket beside a new machine.
// Repair only that idle legacy state, without touching buildings, stock or XP.
export function repairLegacyHomesteadAccess(world: World): void {
  const h = world.homestead, p = world.pete, home = world.peace.home
  if (!h || home === null || h.task || currentProject(world)?.selected || p.next !== null || p.mode !== 'WANDERING' || !['walking', 'homeward', 'waving', 'flowers'].includes(world.peace.activity)) return
  const before = peteReachableTiles(world, p.tile), entrances = neighboringTiles(home).filter(tile => peteWalkableTile(world, tile))
  if (!entrances.length || entrances.some(tile => before.has(tile)) || before.size > 4) return
  const safe = peteReachableTiles(world, entrances[0])
  const distance = (tile: number) => Math.abs(tile % SIZE - p.tile % SIZE) + Math.abs(Math.floor(tile / SIZE) - Math.floor(p.tile / SIZE))
  const target = [...safe.keys()].filter(tile => !world.buildings[tile] && !world.water[tile] && distance(tile) <= 4 && !world.poultry?.birds.some(b => b.tile === tile || b.next === tile)).sort((a, b) => distance(a) - distance(b) || a - b)[0]
  if (target === undefined) return
  Object.assign(p, { tile: target, x: target % SIZE, y: Math.floor(target / SIZE), path: [], pathRevision: -1, travelMs: 0 })
  Object.assign(world.peace, { activity: 'homeward', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}
export function handMillLayout(anchor: number): { tile: number; kind: BuildingKind }[] {
  return [{ tile: anchor + SIZE, kind: 'powerPole' }, { tile: anchor + SIZE + 1, kind: 'generator' }, { tile: anchor, kind: 'sawmill' }]
}
export function freeSite(world: World, tiles: number[], infrastructure = false): boolean {
  if (!infrastructure && tiles.some(tile => infrastructureReserved(world).includes(tile))) return false
  const home = world.peace.home, before = peteReachableTiles(world, world.pete.tile)
  const crossings = infrastructure ? [...(world.homestead?.infrastructure.links ?? []), ...(world.homestead?.infrastructure.plan ? [world.homestead.infrastructure.plan] : [])].flatMap(p => p.parts).filter(p => p.kind === 'belt' || p.kind === 'inserter').map(p => p.tile) : []
  if (home === null || tiles.some(i => {
    const error = placementError(world, i % SIZE, Math.floor(i / SIZE), 'storage')
    // Construction walks to a neighboring work spot before installing an owned low crossing.
    return !inside(i % SIZE, Math.floor(i / SIZE)) || error && !(error === 'Pete is walking through this tile.' && !world.buildings[i] && crossings.includes(i)) || !neighboringTiles(i).some(tile => before.has(tile) && peteWalkableTile(world, tile))
  })) return false
  if (projectPlansConflict(world, { home, direction: 'east', tiles, spots: [], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 }, undefined, crossings)) return false
  const buildings = [...world.buildings]
  for (const tile of tiles) {
    const s = world.homestead?.infrastructure, part = infrastructure ? [...(s?.links ?? []), ...(s?.plan ? [s.plan] : [])].flatMap(p => p.parts).find(p => p.tile === tile) : null
    const position = { x: tile % SIZE, y: Math.floor(tile / SIZE) }
    buildings[tile] = part?.kind === 'belt' ? { ...position, kind: 'belt', direction: part.direction, entry: part.direction, progress: 0, item: null } : part?.kind === 'inserter' ? { ...position, kind: 'inserter', direction: part.direction, phase: 'idle', item: null, elapsedMs: 0 } : { ...position, kind: 'storage', inventory: emptyInventory() }
  }
  const candidate = { ...world, buildings }, after = peteReachableTiles(candidate, world.pete.tile)
  if (!neighboringTiles(home).some(tile => after.has(tile) && peteWalkableTile(candidate, tile))) return false
  const transport = infrastructure ? infrastructureReserved(world) : []
  return world.buildings.every((building, tile) => !building || transport.includes(tile) || !neighboringTiles(tile).some(i => before.has(i) && peteWalkableTile(world, i)) || neighboringTiles(tile).some(i => after.has(i) && peteWalkableTile(candidate, i)))
}
function site(world: World, mill = false): number | null {
  const home = world.peace.home!
  for (let radius = mill ? 4 : 2; radius <= 6; radius++) {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
      const x = home % SIZE + dx, y = Math.floor(home / SIZE) + dy
      if (!inside(x, y) || (mill && (x >= SIZE - 1 || y >= SIZE - 1))) continue
      const tile = y * SIZE + x
      if (freeSite(world, mill ? handMillLayout(tile).map(s => s.tile) : [tile])) return tile
    }
  }
  return null
}
export function begin(world: World, task: HomeTask, target: number | null): void {
  const s = world.homestead!
  s.task = task; s.target = target; s.elapsedMs = 0; s.treeBornAtMs = null
  Object.assign(world.peace, { activity: 'walking', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
  world.pete.path = []; world.pete.pathRevision = -1
}
export function finish(world: World): void {
  const s = world.homestead!, p = world.pete
  if (s.cargoBicycle && s.bikeTile === null) s.bikeTile = p.tile
  s.task = null; s.target = null; s.elapsedMs = 0; s.treeBornAtMs = null; s.nextAtMs = world.timeMs + 1000
  Object.assign(p, { next: null, travelMs: 0, path: [], pathRevision: -1, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE) })
  Object.assign(world.peace, { activity: 'walking', sinceMs: world.timeMs, untilMs: world.timeMs, destination: null })
}
function chooseTree(world: World): number | null {
  const home = world.peace.home!, choices: { tile: number; distance: number }[] = []
  for (let tile = 0; tile < world.buildings.length; tile++) {
    const b = world.buildings[tile]
    if (b?.kind !== 'tree' || treeStage(world, b) !== 'mature' || Math.max(Math.abs(b.x - home % SIZE), Math.abs(b.y - Math.floor(home / SIZE))) > 11) continue
    const spot = miniApproach(world, tile)
    if (spot !== null) choices.push({ tile, distance: Math.abs(spot % SIZE - world.pete.tile % SIZE) + Math.abs(Math.floor(spot / SIZE) - Math.floor(world.pete.tile / SIZE)) })
  }
  choices.sort((a, b) => a.distance - b.distance || a.tile - b.tile)
  return choices[0]?.tile ?? null
}
export function arrived(world: World, tile: number | null, delta: number, construction = false): boolean {
  let spot = tile === null ? null : miniApproach(world, tile)
  if (construction && tile !== null && world.peace.home !== null) {
    const buildings = [...world.buildings]
    buildings[tile] = { kind: 'storage', x: tile % SIZE, y: Math.floor(tile / SIZE), inventory: emptyInventory() }
    const candidate = { ...world, buildings }, entrance = neighboringTiles(world.peace.home).find(i => peteWalkableTile(candidate, i))
    const safe = entrance === undefined ? new Map<number, number>() : peteReachableTiles(candidate, entrance), paths = peteReachableTiles(world, world.pete.tile)
    spot = neighboringTiles(tile).filter(i => safe.has(i) && paths.has(i) && peteWalkableTile(candidate, i)).sort((a, b) => tilePath(paths, a)!.length - tilePath(paths, b)!.length || a - b)[0] ?? null
  }
  if (spot === null) return false
  const h = world.homestead
  const transport = h && ['mineIron', 'mineCopper', 'mineCoal', 'fetchWood', 'feedMill', 'takePanels', 'returnStock', 'fetchIron', 'feedIron', 'takeIron', 'takeCrates', 'fetchCopper', 'feedCopper', 'takeCopper', 'fetchCable', 'feedCable', 'takeCable', 'fetchGear', 'feedGear', 'takeGear', 'fetchCircuits', 'feedCircuits', 'takeCircuits', 'fetchSteam', 'feedSteam', 'takeCoal', 'fetchStamp', 'feedStamp', 'takeBriquettes', 'fetchFuel', 'storeFuel'].includes(h.task ?? '')
  if (h && transport && cargoBicycleAvailable(world)) {
    if (h.bikeTile !== null && h.bikeTile !== world.pete.tile) { miniWalk(world, h.bikeTile, delta); return false }
    h.bikeTile = null
    const done = miniWalk(world, spot, delta, true)
    if (done) h.bikeTile = world.pete.tile
    return done
  }
  return miniWalk(world, spot, delta)
}
function chooseTask(world: World): void {
  const s = world.homestead!, store = materialStore(world)
  if (s.store === null) {
    if (s.carried.iron >= 6 || s.carried.copper >= 6 || s.carried.coal >= 6) { const tile = site(world); if (tile !== null) begin(world, 'buildStore', tile) }
    else if (!inventoryTotal(s.carried)) {
      for (const path of preferredPaths(world)) {
        if (path === 'eco' && chooseTree(world) !== null) { begin(world, 'gather', null); return }
        if (path !== 'eco' && chooseExpansion(world, path)) return
      }
    }
    else if (s.carried.wood < 6) begin(world, 'gather', null)
    else { const tile = site(world); if (tile !== null) begin(world, 'buildStore', tile) }
    return
  }
  if (!store) return
  // Committed material deliveries are never abandoned for another project.
  if (inventoryTotal(s.carried)) { begin(world, 'returnStock', s.store); return }
  if (chooseRebuild(world)) return
  if (s.expansion.plan) { begin(world, 'buildChain', s.store); return }
  for (const path of preferredPaths(world)) {
    if (chooseInfrastructure(world, path)) return
    if (chooseExpansion(world, path)) return
    if (path === 'eco' && chooseShoreline(world)) return
    if (path === 'eco') { chooseEcoTask(world); if (s.task !== null) return }
  }
}
function chooseEcoTask(world: World): void {
  const s = world.homestead!, store = materialStore(world)!
  const level = world.personality.paths.eco.level
  if (level < 3) return
  if (store.storeTier === 0 && store.inventory.woodPanel >= 8) { begin(world, 'expandStore', s.store); return }
  if (s.millAnchor === null && store.wood >= 12) {
    const anchor = site(world, true)
    if (anchor !== null) { s.millAnchor = anchor; begin(world, 'buildMill', s.store) }
    return
  }
  if (s.millAnchor === null) return
  if (s.millBuilt < 3) { begin(world, 'buildMill', s.store); return }
  const mill = world.buildings[s.millAnchor]
  if (mill?.kind !== 'sawmill' || store.inventory.woodPanel >= 12) return
  if (!connectionRunning(world, 'panelReturn') && mill.output.woodPanel && inventoryTotal(store.inventory) + store.wood + 2 <= supplyCapacity(store)) begin(world, 'takePanels', s.millAnchor)
  else if (!mill.job && mill.input.wood === 0 && inventoryTotal(mill.output) < 4 && store.wood >= (store.storeTier === 0 ? 14 : wantsWaterwheel(world) ? 12 : wantsShoreDock(world) ? 10 : wantsEcoReturns(world) ? 20 : 4)) begin(world, 'fetchWood', s.store)
}
// Returns true only while a committed homestead task owns Pete. Otherwise the
// original project, animal, garden, leisure and sleeping routine runs unchanged.
export function advanceHomestead(world: World, delta: number, decision = false): boolean {
  const s = world.homestead
  if (!s || world.peace.home === null) return false
  if (world.rebuilding?.jobs.some(j => j.owner.type === 'store') && !materialStore(world)) return false
  if (s.task === null) {
    if (!decision) return false
    if ((world.timeMs < s.nextAtMs && (!decision || s.nextAtMs - world.timeMs > 2000)) || currentProject(world)?.selected || world.developmentLife?.carriedFruit || world.developmentLife?.carriedWood || world.developmentLife?.carriedSapling || world.leisure?.carried || world.pete.next !== null) return false
    s.nextAtMs = world.timeMs + 2000
    chooseTask(world)
    if (s.task === null) return false
  }
  if (advanceInfrastructure(world, delta)) return true
  if (advanceShoreline(world, delta)) return true
  if (advanceExpansion(world, delta)) return true
  if (s.task === 'gather') {
    if (s.carried.wood >= 6 || s.carried.iron >= 6 || s.carried.copper >= 6 || s.carried.coal >= 6) { const tile = site(world); if (tile !== null) begin(world, 'buildStore', tile); return true }
    const tree = s.target === null ? null : world.buildings[s.target]
    if (tree?.kind !== 'tree' || tree.bornAtMs !== s.treeBornAtMs || treeStage(world, tree) !== 'mature') {
      s.target = chooseTree(world); s.elapsedMs = 0
      const next = s.target === null ? null : world.buildings[s.target]
      s.treeBornAtMs = next?.kind === 'tree' ? next.bornAtMs : null
      if (s.target === null && !s.carried.wood) { for (const path of preferredPaths(world)) if (path !== 'eco' && chooseExpansion(world, path)) return true }
    }
    if (!arrived(world, s.target, delta)) return true
    s.elapsedMs = Math.min(6000, s.elapsedMs + delta * 2)
    if (s.elapsedMs < 6000 || s.target === null) return true
    const result = chopTree(world, s.target % SIZE, Math.floor(s.target / SIZE), false)
    if (result) s.carried.wood += result.wood
    s.target = null; s.treeBornAtMs = null; s.elapsedMs = 0
    if (s.carried.wood >= 6) { const tile = site(world); if (tile !== null) begin(world, 'buildStore', tile) }
    return true
  }
  const store = materialStore(world)
  if (s.task === 'buildStore') {
    if (s.target === null || !freeSite(world, [s.target]) || !arrived(world, s.target, delta, true)) return true
    s.elapsedMs = Math.min(6000, s.elapsedMs + delta * 2)
    if (s.elapsedMs < 6000 || Math.max(s.carried.wood, s.carried.iron, s.carried.copper, s.carried.coal) < 6) return true
    const tile = s.target
    world.buildings[tile] = { kind: 'supplyCrate', x: tile % SIZE, y: Math.floor(tile / SIZE), wood: 0, inventory: emptyInventory(), storeTier: 0 }
    const path = s.carried.iron >= 6 ? 'craftsman' : s.carried.copper >= 6 ? 'inventor' : s.carried.coal >= 6 ? 'industrial' : 'eco'
    s.carried = emptyInventory(); s.store = tile; world.topologyRevision++
    awardHomesteadOnce(world, 'store', { path, xp: 5 }); finish(world)
    return true
  }
  if (!store) return true
  if (s.task === 'buildMill') {
    if (!s.carried.wood) {
      if (!arrived(world, s.store, delta) || store.wood < 12) return true
      store.wood -= 12; s.carried.wood = 12
    }
    if (s.millAnchor === null) return true
    const step = handMillLayout(s.millAnchor)[s.millBuilt]
    if (!step || world.buildings[step.tile] || world.water[step.tile] || !arrived(world, step.tile, delta, true) || !freeSite(world, [step.tile])) return true
    s.elapsedMs = Math.min(4000, s.elapsedMs + delta * 2)
    if (s.elapsedMs < 4000 || !placeBuilding(world, step.tile % SIZE, Math.floor(step.tile / SIZE), step.kind, 'east')) return true
    s.millBuilt++; s.elapsedMs = 0
    if (s.millBuilt === 3) { s.carried.wood = 0; awardHomesteadOnce(world, 'mill', { path: 'eco', xp: 12 }); finish(world) }
    return true
  }
  if (!arrived(world, s.target, delta)) return true
  const mill = s.millAnchor === null ? null : world.buildings[s.millAnchor]
  if (s.task === 'fetchWood') {
    if (store.wood < (store.storeTier === 0 ? 14 : wantsWaterwheel(world) ? 12 : wantsShoreDock(world) ? 10 : 4) || mill?.kind !== 'sawmill') { finish(world); return true }
    store.wood -= 2; s.carried.wood = 2; begin(world, 'feedMill', s.millAnchor)
  } else if (s.task === 'feedMill') {
    if (mill?.kind !== 'sawmill') { begin(world, 'returnStock', s.store); return true }
    const amount = Math.max(0, Math.min(s.carried.wood, 2 - inventoryTotal(mill.input)))
    mill.input.wood += amount; s.carried.wood -= amount
    if (!s.carried.wood) finish(world)
    else begin(world, 'returnStock', s.store)
  } else if (s.task === 'takePanels') {
    if (mill?.kind !== 'sawmill' || !mill.output.woodPanel) { finish(world); return true }
    const amount = Math.min(2, mill.output.woodPanel)
    mill.output.woodPanel -= amount; s.carried.woodPanel = amount; begin(world, 'returnStock', s.store)
  } else if (s.task === 'returnStock') {
    if (store.wood + inventoryTotal(store.inventory) + inventoryTotal(s.carried) > supplyCapacity(store)) return true
    if (s.carried.iron === 3) awardActivity(world.personality, { path: 'craftsman', xp: 3 })
    if (s.carried.coal === 3) awardActivity(world.personality, { path: 'industrial', xp: 3 })
    if (s.carried.copper === 3) awardActivity(world.personality, { path: 'inventor', xp: 3 })
    store.wood += s.carried.wood
    for (const item of ITEMS) if (item !== 'wood') store.inventory[item] += s.carried[item]
    s.carried = emptyInventory(); finish(world)
  } else if (s.task === 'expandStore') {
    if (!s.carried.woodPanel) {
      if (store.inventory.woodPanel < 8 || store.storeTier !== 0) { finish(world); return true }
      store.inventory.woodPanel -= 8; s.carried.woodPanel = 8
    }
    s.elapsedMs = Math.min(8000, s.elapsedMs + delta * 2)
    if (s.elapsedMs === 8000) { store.storeTier = 1; s.carried.woodPanel = 0; awardHomesteadOnce(world, 'roof', { path: 'eco', xp: 8 }); finish(world) }
  }
  return true
}
export const HOME_TASK_LABELS: Record<HomeTask, string> = { buildPavilion: 'Ich baue den Obstgarten-Pavillon aus bezahlten Platten und Kisten', buildLoading: 'Ich baue meinen bezahlten Verladeplatz', fetchLoading: 'Ich hole überschüssigen Brennstoff für den Aufzug', feedLoading: 'Ich bringe Brennstoff zum Verladeplatz', takeLoading: 'Ich hole tatsächlich verladenen Brennstoff', parkBicycle: 'Ich parke mein Lastenrad außerhalb der neuen Transportstrecke', buildConnection: 'Ich baue meine Materialverbindung', buildWheel: 'Ich baue mein Wasserrad mit Stromanschluss', finishOrder: 'Ich arbeite an einem bezahlten Ausbauauftrag', fetchGear: 'Ich hole Eisenplatten für Zahnräder', feedGear: 'Ich beliefere den Zahnrad-Assembler', takeGear: 'Ich hole fertige Zahnräder', upgradeBicycle: 'Ich baue mein Lastenfahrrad', buildBridge: 'Ich baue eine bezahlte Fußbrücke', buildDock: 'Ich baue meinen Angelsteg mit Ruderboot', takeCoal: 'Ich hole geförderte Kohle aus dem Brennstofflager', fetchStamp: 'Ich hole Kohle für den Stampfer', feedStamp: 'Ich bringe Kohle zum Stampfer', takeBriquettes: 'Ich hole gepresste Briketts', fetchFuel: 'Ich hole Briketts für den Kessel', storeFuel: 'Ich bringe Brennstoff ins Kessellager', fetchSteam: 'Ich hole Kohle für den Kessel', feedSteam: 'Ich trage Kohle zum Dampfantrieb', mineCoal: 'Ich baue Kohle als Brennstoff ab', fetchCircuits: 'Ich hole Kupferplatten und Kupferkabel für Schaltkreise', feedCircuits: 'Ich bringe echte Zutaten zum Schaltkreis-Assembler', takeCircuits: 'Ich hole fertige Schaltkreise für meine Flugwerkstatt', mineCopper: 'Ich baue Kupfererz ab', fetchCopper: 'Ich hole Kupfererz', feedCopper: 'Ich bringe Kupfererz zum Kupferofen', takeCopper: 'Ich hole fertige Kupferplatten', fetchCable: 'Ich hole Kupferplatten für Kabel', feedCable: 'Ich bringe Platten zum Kabel-Assembler', takeCable: 'Ich hole fertige Kupferkabel', gather: 'Ich fälle ausgewachsene Bäume für mein Materiallager', buildStore: 'Ich baue mein Materiallager aus 6 Holz, 6 Eisenerz, 6 Kupfererz oder 6 Kohle', buildMill: 'Ich baue mein Sägewerk mit Stromversorgung', fetchWood: 'Ich hole Holz aus dem Materiallager', feedMill: 'Ich bringe Holz zum Sägewerk', takePanels: 'Ich hole fertige Holzplatten', returnStock: 'Ich trage Material zurück ins Lager', expandStore: 'Ich überdache und erweitere mein Materiallager', mineIron: 'Ich baue Eisenerz ab', buildChain: 'Ich erweitere meine Produktion', improve: 'Ich verbessere meinen Hof', fetchIron: 'Ich hole Eisenerz aus dem Lager', feedIron: 'Ich bringe Erz zum Schmelzofen', takeIron: 'Ich hole fertige Eisenplatten', takeCrates: 'Ich hole fertige Holzkisten' }
export function homesteadHint(world: World): string {
  const s = world.homestead!, store = materialStore(world)
  if (s.task) {
    if (s.task === 'finishOrder' && s.infrastructure.order && s.infrastructure[s.infrastructure.order] === 3) return 'Ich erledige einen bezahlten Versorgungsauftrag mit vorhandenen Produkten. Der Ausbau bleibt abgeschlossen.'
    if (s.task === 'buildChain' || s.task === 'improve') return expansionSummary(world)
    const workTile = s.task === 'buildMill' && s.millAnchor !== null ? handMillLayout(s.millAnchor)[s.millBuilt]?.tile : s.target
    if ((s.task === 'buildStore' || s.task === 'buildMill') && workTile !== null && workTile !== undefined && (world.water[workTile] || world.buildings[workTile])) return 'Mein Bauplatz ist belegt. Ich behalte mein Material und meinen Baufortschritt.'
    if (s.task === 'returnStock' && store && store.wood + inventoryTotal(store.inventory) + inventoryTotal(s.carried) > supplyCapacity(store)) return 'Mein Materiallager ist voll. Ich behalte das getragene Material, bis wieder Platz ist.'
    if (s.task === 'gather' && s.carried.wood >= 6) return 'Ich habe 6 Holz für das Materiallager. Mir fehlt eine freie, erreichbare Baufläche nahe am Baumhaus.'
    if (s.task === 'gather' && s.target === null) return 'Ich brauche erreichbare Ressourcen. Platziere Wald, Eisen oder Kupfer in meiner Nähe.'
    return `${HOME_TASK_LABELS[s.task]}${s.elapsedMs ? ` · ${Math.floor(s.elapsedMs / (s.task === 'expandStore' ? 8000 : s.task === 'buildMill' ? 4000 : 6000) * 100)} %` : ''}.`
  }
  if (s.store !== null && !store) return 'Mein Materiallager fehlt. Mein Baufortschritt und getragenes Material bleiben erhalten.'
  if (!store) return 'Platziere Wald, Eisen oder Kupfer in meiner Nähe. Ich sammle selbst Material, baue ein Lager und verwirkliche meine Projekte.'
  if (world.harvestProject?.selected) return world.harvestProject.carried ? 'Ich bringe das gefällte Holz ins Materiallager.' : 'Ich hacke Holz für meine nächsten Projekte.'
  const project = currentProject(world)
  if (project) return `Ich arbeite an meinem Projekt. Das Material kommt aus meinem Lager · ${store.wood} Holz verfügbar.`
  return `Mein Lager: ${store.wood} Holz · ${store.inventory.woodPanel} Holzplatten · ${store.inventory.iron} Eisenerz · ${store.inventory.ironPlate} Eisenplatten · ${store.inventory.copper} Kupfererz · ${store.inventory.copperPlate} Kupferplatten · ${store.inventory.copperCable} Kabel. ${expansionSummary(world)}`
}
