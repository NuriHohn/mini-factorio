import { emptyInventory, inventoryTotal } from './items'
import type { Inventory } from './items'
import { chopTree, treeStage } from './nature'
import { awardActivity } from './personality'
import { miniApproach, miniWalk } from './petesWorld'
import { currentProject, projectPlansConflict } from './secretProject'
import { supplyCapacity } from './supplyCrate'
import { inside, placeBuilding, placementError, SIZE } from './world'
import type { BuildingKind, SupplyCrate, World } from './world'

export const HOME_TASKS = ['gather', 'buildStore', 'buildMill', 'fetchWood', 'feedMill', 'takePanels', 'returnStock', 'expandStore'] as const
export type HomeTask = typeof HOME_TASKS[number]
export interface Homestead {
  store: number | null
  task: HomeTask | null
  target: number | null
  treeBornAtMs: number | null
  carried: Inventory
  elapsedMs: number
  nextAtMs: number
  millAnchor: number | null
  millBuilt: number
}
export function createHomestead(): Homestead {
  return { store: null, task: null, target: null, treeBornAtMs: null, carried: emptyInventory(), elapsedMs: 0, nextAtMs: 0, millAnchor: null, millBuilt: 0 }
}
export function materialStore(world: World): SupplyCrate | null {
  const tile = world.homestead?.store, b = tile === null || tile === undefined ? null : world.buildings[tile]
  return b?.kind === 'supplyCrate' && b.storeTier !== undefined ? b : null
}
export function handMillLayout(anchor: number): { tile: number; kind: BuildingKind }[] {
  return [{ tile: anchor + SIZE, kind: 'powerPole' }, { tile: anchor + SIZE + 1, kind: 'generator' }, { tile: anchor, kind: 'sawmill' }]
}
function freeSite(world: World, tiles: number[]): boolean {
  const home = world.peace.home
  if (home === null || tiles.some(i => !inside(i % SIZE, Math.floor(i / SIZE)) || placementError(world, i % SIZE, Math.floor(i / SIZE), 'storage') || miniApproach(world, i) === null)) return false
  return !projectPlansConflict(world, { home, direction: 'east', tiles, spots: [], phase: 'collecting', crate: null, built: 0, carried: 0, elapsedMs: 0 })
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
function begin(world: World, task: HomeTask, target: number | null): void {
  const s = world.homestead!
  s.task = task; s.target = target; s.elapsedMs = 0; s.treeBornAtMs = null
  Object.assign(world.peace, { activity: 'walking', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
  world.pete.path = []; world.pete.pathRevision = -1
}
function finish(world: World): void {
  const s = world.homestead!, p = world.pete
  s.task = null; s.target = null; s.elapsedMs = 0; s.treeBornAtMs = null; s.nextAtMs = world.timeMs + 10000
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
function arrived(world: World, tile: number | null, delta: number): boolean {
  const spot = tile === null ? null : miniApproach(world, tile)
  return spot !== null && miniWalk(world, spot, delta)
}
function chooseTask(world: World): void {
  const s = world.homestead!, store = materialStore(world)
  if (s.store === null) {
    if (s.carried.wood < 6) begin(world, 'gather', null)
    else { const tile = site(world); if (tile !== null) begin(world, 'buildStore', tile) }
    return
  }
  if (!store) return
  // Committed material deliveries are never abandoned for another project.
  if (inventoryTotal(s.carried)) { begin(world, 'returnStock', s.store); return }
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
  if (mill.output.woodPanel && inventoryTotal(store.inventory) + store.wood + 2 <= supplyCapacity(store)) begin(world, 'takePanels', s.millAnchor)
  else if (!mill.job && mill.input.wood === 0 && store.wood >= 14) begin(world, 'fetchWood', s.store)
}
// Returns true only while a committed homestead task owns Pete. Otherwise the
// original project, animal, garden, leisure and sleeping routine runs unchanged.
export function advanceHomestead(world: World, delta: number, decision = false): boolean {
  const s = world.homestead
  if (!s || world.peace.home === null) return false
  if (s.task === null) {
    if ((!decision && world.timeMs < s.nextAtMs) || currentProject(world)?.selected || world.pete.next !== null || !['walking', 'homeward', 'waving', 'flowers'].includes(world.peace.activity)) return false
    s.nextAtMs = world.timeMs + 2000
    chooseTask(world)
    if (s.task === null) return false
  }
  if (s.task === 'gather') {
    if (s.carried.wood >= 6) { const tile = site(world); if (tile !== null) begin(world, 'buildStore', tile); return true }
    const tree = s.target === null ? null : world.buildings[s.target]
    if (tree?.kind !== 'tree' || tree.bornAtMs !== s.treeBornAtMs || treeStage(world, tree) !== 'mature') {
      s.target = chooseTree(world); s.elapsedMs = 0
      const next = s.target === null ? null : world.buildings[s.target]
      s.treeBornAtMs = next?.kind === 'tree' ? next.bornAtMs : null
    }
    if (!arrived(world, s.target, delta)) return true
    s.elapsedMs = Math.min(6000, s.elapsedMs + delta)
    if (s.elapsedMs < 6000 || s.target === null) return true
    const result = chopTree(world, s.target % SIZE, Math.floor(s.target / SIZE), false)
    if (result) s.carried.wood += result.wood
    s.target = null; s.treeBornAtMs = null; s.elapsedMs = 0
    if (s.carried.wood >= 6) { const tile = site(world); if (tile !== null) begin(world, 'buildStore', tile) }
    return true
  }
  const store = materialStore(world)
  if (s.task === 'buildStore') {
    if (s.target === null || !freeSite(world, [s.target]) || !arrived(world, s.target, delta)) return true
    s.elapsedMs = Math.min(6000, s.elapsedMs + delta)
    if (s.elapsedMs < 6000 || s.carried.wood < 6) return true
    const tile = s.target
    world.buildings[tile] = { kind: 'supplyCrate', x: tile % SIZE, y: Math.floor(tile / SIZE), wood: s.carried.wood - 6, inventory: emptyInventory(), storeTier: 0 }
    s.carried.wood = 0; s.store = tile; world.topologyRevision++
    awardActivity(world.personality, { path: 'eco', xp: 5 }); finish(world)
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
    if (!step || world.buildings[step.tile] || world.water[step.tile] || !arrived(world, step.tile, delta) || !freeSite(world, [step.tile])) return true
    s.elapsedMs = Math.min(4000, s.elapsedMs + delta)
    if (s.elapsedMs < 4000 || !placeBuilding(world, step.tile % SIZE, Math.floor(step.tile / SIZE), step.kind, 'east')) return true
    s.millBuilt++; s.elapsedMs = 0
    if (s.millBuilt === 3) { s.carried.wood = 0; awardActivity(world.personality, { path: 'eco', xp: 12 }); finish(world) }
    return true
  }
  if (!arrived(world, s.target, delta)) return true
  const mill = s.millAnchor === null ? null : world.buildings[s.millAnchor]
  if (s.task === 'fetchWood') {
    if (store.wood < 14 || mill?.kind !== 'sawmill') { finish(world); return true }
    store.wood -= 2; s.carried.wood = 2; begin(world, 'feedMill', s.millAnchor)
  } else if (s.task === 'feedMill') {
    if (mill?.kind !== 'sawmill') { begin(world, 'returnStock', s.store); return true }
    const amount = Math.min(s.carried.wood, 2 - mill.input.wood)
    mill.input.wood += amount; s.carried.wood -= amount
    if (!s.carried.wood) finish(world)
  } else if (s.task === 'takePanels') {
    if (mill?.kind !== 'sawmill' || !mill.output.woodPanel) { finish(world); return true }
    const amount = Math.min(2, mill.output.woodPanel)
    mill.output.woodPanel -= amount; s.carried.woodPanel = amount; begin(world, 'returnStock', s.store)
  } else if (s.task === 'returnStock') {
    if (store.wood + inventoryTotal(store.inventory) + inventoryTotal(s.carried) > supplyCapacity(store)) return true
    store.wood += s.carried.wood; store.inventory.woodPanel += s.carried.woodPanel
    s.carried = emptyInventory(); finish(world)
  } else if (s.task === 'expandStore') {
    if (!s.carried.woodPanel) {
      if (store.inventory.woodPanel < 8 || store.storeTier !== 0) { finish(world); return true }
      store.inventory.woodPanel -= 8; s.carried.woodPanel = 8
    }
    s.elapsedMs = Math.min(8000, s.elapsedMs + delta)
    if (s.elapsedMs === 8000) { store.storeTier = 1; s.carried.woodPanel = 0; awardActivity(world.personality, { path: 'eco', xp: 8 }); finish(world) }
  }
  return true
}
export const HOME_TASK_LABELS: Record<HomeTask, string> = { gather: 'Ich fälle ausgewachsene Bäume für mein Materiallager', buildStore: 'Ich baue mein Materiallager aus 6 Holz', buildMill: 'Ich baue mein Sägewerk mit Stromversorgung', fetchWood: 'Ich hole Holz aus dem Materiallager', feedMill: 'Ich bringe Holz zum Sägewerk', takePanels: 'Ich hole fertige Holzplatten', returnStock: 'Ich trage Material zurück ins Lager', expandStore: 'Ich überdache und erweitere mein Materiallager' }
export function homesteadHint(world: World): string {
  const s = world.homestead!, store = materialStore(world)
  if (s.task) {
    const workTile = s.task === 'buildMill' && s.millAnchor !== null ? handMillLayout(s.millAnchor)[s.millBuilt]?.tile : s.target
    if ((s.task === 'buildStore' || s.task === 'buildMill') && workTile !== null && workTile !== undefined && (world.water[workTile] || world.buildings[workTile])) return 'Mein Bauplatz ist belegt. Ich behalte mein Material und meinen Baufortschritt.'
    if (s.task === 'returnStock' && store && store.wood + inventoryTotal(store.inventory) + inventoryTotal(s.carried) > supplyCapacity(store)) return 'Mein Materiallager ist voll. Ich behalte das getragene Material, bis wieder Platz ist.'
    if (s.task === 'gather' && s.carried.wood >= 6) return 'Ich habe 6 Holz für das Materiallager. Mir fehlt eine freie, erreichbare Baufläche nahe am Baumhaus.'
    if (s.task === 'gather' && s.target === null) return 'Ich brauche erreichbare ausgewachsene Bäume. Platziere Wald in meiner Nähe.'
    return `${HOME_TASK_LABELS[s.task]}${s.elapsedMs ? ` · ${Math.floor(s.elapsedMs / (s.task === 'expandStore' ? 8000 : s.task === 'buildMill' ? 4000 : 6000) * 100)} %` : ''}.`
  }
  if (s.store !== null && !store) return 'Mein Materiallager fehlt. Mein Baufortschritt und getragenes Material bleiben erhalten.'
  if (!store) return 'Platziere Wald in meiner Nähe. Ich sammle selbst Holz, baue ein Materiallager und verwirkliche meine Projekte.'
  if (world.harvestProject?.selected) return world.harvestProject.carried ? 'Ich bringe das gefällte Holz ins Materiallager.' : 'Ich hacke Holz für meine nächsten Projekte.'
  const project = currentProject(world)
  if (project) return `Ich arbeite an meinem Projekt. Das Material kommt aus meinem Lager · ${store.wood} Holz verfügbar.`
  return `Mein Materiallager: ${store.wood} Holz · ${store.inventory.woodPanel} Holzplatten. Ich baue, pflege meinen Garten und kümmere mich um meine Hühner. Sägewerk ab Öko-Stufe 3.`
}
