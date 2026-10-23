import { awardActivity } from './personality'
import { recordProduction } from './analytics'
import { neighboringTiles, peteReachableTiles, tilePath } from './navigation'
import { planPlanting, plantingSite } from './ecoProjects'
import { plantTree } from './nature'
import { SIZE } from './world'
import type { PeteDevelopment, World } from './world'
export const DEVELOPMENT_KINDS = ['orchard', 'bicycle', 'mechanic', 'winch', 'nursery', 'house'] as const
export type DevelopmentKind = typeof DEVELOPMENT_KINDS[number]
export function developmentKind(kind: string | undefined): kind is DevelopmentKind { return DEVELOPMENT_KINDS.some(k => k === kind) }
export const DEVELOPMENT_NAMES: Record<DevelopmentKind, string> = { orchard: 'Orchard', bicycle: 'Bicycle', mechanic: 'Mechanic workshop', winch: 'Workshop hoist', nursery: 'Tree nursery', house: 'Treehouse annex' }
export const TASKS = ['tendOrchard', 'pickFruit', 'storeFruit', 'cookFruit', 'mechanics', 'collectNurseryWood', 'nursing', 'takeSapling', 'plantSapling', 'winching', 'cycle', 'annexRest'] as const
export type DevelopmentTask = typeof TASKS[number]
export interface DevelopmentLife {
  seed: number; task: DevelopmentTask | null; target: number | null; plant: number | null
  carriedFruit: number; fruit: number; carriedWood: number; carriedSapling: number; saplings: number
  nextAt: Record<DevelopmentTask, number>; ecoXp: number; craftsmanXp: number; industrialXp: number
}
export function createDevelopmentLife(): DevelopmentLife { return { seed: 0x6170706c, task: null, target: null, plant: null, carriedFruit: 0, fruit: 0, carriedWood: 0, carriedSapling: 0, saplings: 0, nextAt: Object.fromEntries(TASKS.map(t => [t, 0])) as Record<DevelopmentTask, number>, ecoXp: 0, craftsmanXp: 0, industrialXp: 0 } }
export function developmentBuilding(world: World, kind: DevelopmentKind): PeteDevelopment | null {
  const project = world[`${kind}Project`], b = project?.phase === 'complete' ? world.buildings[project.tiles[0]] : null
  return b?.kind === 'peteDevelopment' && b.development === kind ? b : null
}
export function approach(world: World, tile: number): number | null {
  const parents = peteReachableTiles(world, world.pete.tile)
  return neighboringTiles(tile).filter(i => !world.water[i] && !world.buildings[i] && parents.has(i)).sort((a, b) => tilePath(parents, a)!.length - tilePath(parents, b)!.length || a - b)[0] ?? null
}
function atBuilding(world: World, kind: DevelopmentKind): number | null { const b = developmentBuilding(world, kind); return b ? approach(world, b.y * SIZE + b.x) : null }
function ready(world: World, task: DevelopmentTask): boolean { return world.timeMs >= world.developmentLife!.nextAt[task] }
export function developmentDuration(task: DevelopmentTask): number { return task === 'cycle' ? 1000 : task === 'pickFruit' ? 2000 : task === 'storeFruit' ? 1500 : task === 'collectNurseryWood' || task === 'takeSapling' ? 1000 : task === 'annexRest' ? 12000 : task === 'winching' ? 4000 : 6000 }
function begin(world: World, task: DevelopmentTask, target: number, plant: number | null = null) {
  const s = world.developmentLife!
  s.task = task; s.target = target; s.plant = plant
  return { activity: 'developmentward' as const, destination: target }
}
export function developmentDecision(world: World) {
  if (world.peace.home === null || (!world.developmentLife && !DEVELOPMENT_KINDS.some(k => developmentBuilding(world, k)))) return null
  const s = world.developmentLife ??= createDevelopmentLife(), home = approach(world, world.peace.home)
  if (s.carriedFruit) return home !== null && s.fruit + s.carriedFruit <= 12 ? begin(world, 'storeFruit', home) : null
  if (s.carriedSapling) { const p = planPlanting(world); return p ? begin(world, 'plantSapling', p.spots[0], p.tiles[0]) : null }
  if (s.carriedWood) { const spot = atBuilding(world, 'nursery'); return spot === null ? null : begin(world, 'nursing', spot) }
  const options: { task: DevelopmentTask; tile: number; plant?: number }[] = []
  const add = (task: DevelopmentTask, kind: DevelopmentKind, allowed = true) => { const tile = allowed && ready(world, task) ? atBuilding(world, kind) : null; if (tile !== null) options.push({ task, tile }) }
  const orchard = developmentBuilding(world, 'orchard'), mechanic = developmentBuilding(world, 'mechanic')
  add('tendOrchard', 'orchard', !!orchard && orchard.fruit < 6)
  add('pickFruit', 'orchard', !!orchard && orchard.fruit >= 2 && s.fruit <= 10)
  if (s.fruit && ready(world, 'cookFruit')) { const fire = world.campfireProject; const tile = fire?.phase === 'complete' && world.buildings[fire.tiles[0]]?.kind === 'peteCampfire' ? approach(world, fire.tiles[0]) : null; if (tile !== null) options.push({ task: 'cookFruit', tile }) }
  add('mechanics', 'mechanic', !!mechanic && mechanic.gears >= 2 && mechanic.modules < 4)
  add('winching', 'winch'); add('cycle', 'bicycle'); add('annexRest', 'house')
  if (developmentBuilding(world, 'nursery') && s.saplings < 3 && ready(world, 'collectNurseryWood')) {
    for (let i = 0; i < world.buildings.length; i++) { const b = world.buildings[i]; if (b?.kind === 'supplyCrate' && b.wood >= 2) { const tile = approach(world, i); if (tile !== null) { options.push({ task: 'collectNurseryWood', tile }); break } } }
  }
  add('takeSapling', 'nursery', s.saplings > 0 && ready(world, 'plantSapling'))
  if (!options.length) return null
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0
  const choice = options[Math.floor(s.seed / 4294967296 * options.length)]
  return begin(world, choice.task, choice.tile, choice.plant ?? null)
}
export function beginDevelopmentWork(world: World) {
  const s = world.developmentLife
  if (world.peace.activity === 'cycling') return { activity: 'dismounting' as const, duration: 1000 }
  if (!s?.task || world.peace.activity !== 'developmentward' || s.target !== world.pete.tile) return null
  return { activity: 'developmentWork' as const, duration: developmentDuration(s.task) }
}
function reward(world: World, path: 'eco' | 'craftsman' | 'industrial', xp: number) { world.developmentLife![`${path}Xp`] += xp; awardActivity(world.personality, { path, xp }) }
export function finishDevelopment(world: World): boolean {
  const s = world.developmentLife
  if (!s?.task) return false
  const task = s.task
  if (task === 'cycle' && world.peace.activity === 'developmentWork') {
    const parents = peteReachableTiles(world, world.pete.tile), origin = world.pete.tile
    const destinations = [...parents.keys()].filter(i => { const path = tilePath(parents, i)!; return path.length >= 3 && path.length <= 6 && path.every(t => !world.water[t] && !world.buildings[t]) })
    const destination = destinations[(s.seed >>> 8) % Math.max(1, destinations.length)]
    if (destination !== undefined) {
      const out = tilePath(parents, destination)!, back = [...out.slice(0, -1).reverse(), origin]
      Object.assign(world.pete, { path: [...out, ...back], pathRevision: world.topologyRevision })
      Object.assign(world.peace, { activity: 'cycling', sinceMs: world.timeMs, untilMs: world.timeMs, destination: origin })
      s.target = origin
      return true
    }
  } else if (task === 'tendOrchard') {
    const b = developmentBuilding(world, 'orchard'); if (b) { b.fruit = Math.min(6, b.fruit + 2); reward(world, 'eco', 2) }
  } else if (task === 'pickFruit') {
    const b = developmentBuilding(world, 'orchard'); if (b && b.fruit >= 2) { b.fruit -= 2; s.carriedFruit = 2 }
  } else if (task === 'storeFruit') {
    if (s.carriedFruit && s.fruit + s.carriedFruit <= 12) { s.fruit += s.carriedFruit; s.carriedFruit = 0; reward(world, 'eco', 4) }
  } else if (task === 'cookFruit') { if (s.fruit) { s.fruit--; reward(world, 'eco', 2) } }
  else if (task === 'mechanics') {
    const b = developmentBuilding(world, 'mechanic')
    if (b && b.gears >= 2 && b.modules < 4) { b.gears -= 2; b.modules++; world.produced.mechanicModule++; recordProduction(world, { mechanicModule: 1 }, { ironGear: 2 }); reward(world, 'industrial', 5) }
  } else if (task === 'collectNurseryWood') {
    const b = neighboringTiles(world.pete.tile).map(i => world.buildings[i]).find(b => b?.kind === 'supplyCrate' && b.wood >= 2)
    if (b?.kind === 'supplyCrate') { b.wood -= 2; s.carriedWood = 2 }
  } else if (task === 'nursing') { if (s.carriedWood === 2 && s.saplings < 3) { s.carriedWood = 0; s.saplings++; reward(world, 'eco', 3) } }
  else if (task === 'takeSapling' && s.saplings) { s.saplings--; s.carriedSapling = 1 }
  else if (task === 'plantSapling' && s.carriedSapling && s.plant !== null && plantingSite(world, s.plant)) {
    // Existing planting command checks occupancy/connectivity; the nursery supplies its paid seedling.
    if (plantTree(world, s.plant % SIZE, Math.floor(s.plant / SIZE), 'oak')) { s.carriedSapling = 0; reward(world, 'eco', 5) }
  } else if (task === 'winching') reward(world, 'industrial', 2)
  else if (task === 'annexRest') reward(world, 'craftsman', 2)
  if (world.peace.activity === 'dismounting') reward(world, 'craftsman', 3)
  s.nextAt[task] = world.timeMs + (task === 'cycle' || task === 'annexRest' ? 60000 : 30000)
  s.task = null; s.target = null; s.plant = null
  return false
}
export function developmentTargetValid(world: World): boolean {
  const s = world.developmentLife
  if (!s?.task || s.target === null || world.peace.home === null) return false
  if (world.water[s.target] || world.buildings[s.target]) return false
  if (s.task === 'storeFruit') return neighboringTiles(world.peace.home).includes(s.target) && s.carriedFruit > 0
  if (s.task === 'collectNurseryWood') return !!developmentBuilding(world, 'nursery') && neighboringTiles(s.target).some(i => { const b = world.buildings[i]; return b?.kind === 'supplyCrate' && b.wood >= 2 })
  if (s.task === 'cookFruit') return s.fruit > 0 && neighboringTiles(s.target).some(i => world.buildings[i]?.kind === 'peteCampfire')
  if (s.task === 'plantSapling') return s.carriedSapling === 1 && s.plant !== null && neighboringTiles(s.plant).includes(s.target) && plantingSite(world, s.plant)
  const kind = s.task === 'mechanics' ? 'mechanic' : s.task === 'winching' ? 'winch' : s.task === 'cycle' ? 'bicycle' : s.task === 'annexRest' ? 'house' : s.task === 'nursing' || s.task === 'takeSapling' ? 'nursery' : 'orchard'
  const b = developmentBuilding(world, kind)
  if (!b) return false
  if (s.task === 'cycle' && ['cycling', 'dismounting'].includes(world.peace.activity)) return true
  if (!neighboringTiles(b.y * SIZE + b.x).includes(s.target)) return false
  return s.task === 'mechanics' ? b.gears >= 2 && b.modules < 4 : s.task === 'takeSapling' ? s.saplings > 0 : s.task === 'pickFruit' ? b.fruit >= 2 : s.task === 'nursing' ? s.carriedWood === 2 && s.saplings < 3 : true
}
export function refreshDevelopment(world: World): void {
  const s = world.developmentLife
  if (!s) return
  if (!['developmentward', 'developmentWork', 'cycling', 'dismounting'].includes(world.peace.activity)) { s.task = null; s.target = null; s.plant = null; return }
  if (developmentTargetValid(world)) return
  s.task = null; s.target = null; s.plant = null
  Object.assign(world.pete, { next: null, travelMs: 0, x: world.pete.tile % SIZE, y: Math.floor(world.pete.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(world.peace, { activity: 'homeward', sinceMs: world.timeMs, untilMs: world.timeMs, destination: null })
}
