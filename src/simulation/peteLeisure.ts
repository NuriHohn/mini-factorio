import { awardActivity } from './personality'
import { PETE_PROJECTS } from './projectRegistry'
import { serviceCrossing, neighboringTiles, peteReachableTiles, tilePath } from './navigation'
import { SIZE } from './world'
import type { Position, World } from './world'
export const TREASURES = [
  { id: 'stone', label: 'Glittering stone', icon: '◆', comment: 'It catches the light just right.' },
  { id: 'feather', label: 'Unusual feather', icon: '❧', comment: 'Maybe this could help me fly…' },
  { id: 'relic', label: 'Rusty wheel relic', icon: '⚙', comment: 'A keepsake, not a factory gear.' },
  { id: 'coin', label: 'Mysterious coin', icon: '◉', comment: 'Who left this here?' },
  { id: 'crystal', label: 'Odd crystal', icon: '✧', comment: 'Definitely worth keeping.' },
] as const
export type TreasureId = typeof TREASURES[number]['id']
export const FIND_COOLDOWN_MS = 180000
export const FLIGHT_COOLDOWN_MS = 30000
export const PRACTICE_XP = 15
export interface PeteLeisure {
  seed: number
  collection: Record<TreasureId, number>
  pending: { id: TreasureId; tile: number } | null
  carried: TreasureId | null
  nextFindAtMs: number
  nextFlightAtMs: number
  practices: number
  flight: { startMs: number; durationMs: number; tile: number; pad: number; practice: boolean; crash: boolean } | null
}
export type LeisureActivity = 'treasureward' | 'pickingTreasure' | 'treasureHomeward' | 'storingTreasure' | 'flightward' | 'flying' | 'crashRest'
export const LEISURE_ACTIVITIES: readonly string[] = ['treasureward', 'pickingTreasure', 'treasureHomeward', 'storingTreasure', 'flightward', 'flying', 'crashRest']
export function createLeisure(world: World): PeteLeisure {
  return { seed: 0x74726561, collection: { stone: 0, feather: 0, relic: 0, coin: 0, crystal: 0 }, pending: null, carried: null, nextFindAtMs: world.timeMs + FIND_COOLDOWN_MS, nextFlightAtMs: world.timeMs, practices: 0, flight: null }
}
function random(state: PeteLeisure): number { state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0; return state.seed / 4294967296 }
export function leisureSpot(world: World, kind: 'treasure' | 'flightpad'): number | null {
  const project = kind === 'treasure' ? world.treasureProject : world.flightProject
  if (project?.phase !== 'complete' || world.buildings[project.tiles[0]]?.kind !== (kind === 'treasure' ? 'peteTreasure' : 'peteFlightpad')) return null
  const paths = peteReachableTiles(world, world.pete.tile)
  return neighboringTiles(project.tiles[0]).filter(i => !world.water[i] && (!world.buildings[i] || serviceCrossing(world, i)) && paths.has(i))
    .sort((a, b) => (tilePath(paths, a)?.length ?? Infinity) - (tilePath(paths, b)?.length ?? Infinity) || a - b)[0] ?? null
}
export function leisureDecision(world: World): { activity: LeisureActivity; destination: number } | null {
  if (world.peace.home === null) return null
  const chest = leisureSpot(world, 'treasure'), pad = leisureSpot(world, 'flightpad')
  if (!world.leisure && (chest !== null || pad !== null)) world.leisure = createLeisure(world)
  const state = world.leisure
  if (!state) return null
  if (state.carried) return chest === null ? null : { activity: 'treasureHomeward', destination: chest }
  if (pad !== null && world.personality.paths.inventor.level >= 4 && world.timeMs >= state.nextFlightAtMs && random(state) < .5) return { activity: 'flightward', destination: pad }
  if (chest === null || world.timeMs < state.nextFindAtMs) return null
  state.nextFindAtMs = world.timeMs + FIND_COOLDOWN_MS
  if (random(state) >= .5) return null
  const home = world.peace.home, pete = world.pete.tile, paths = peteReachableTiles(world, pete)
  const sites = [...paths.keys()].filter(i => !world.buildings[i] && !world.water[i] && i !== world.yard?.entrance && i !== world.chickenRun?.entrance && Math.max(Math.abs(i % SIZE - pete % SIZE), Math.abs(Math.floor(i / SIZE) - Math.floor(pete / SIZE))) <= 4 && (tilePath(paths, i)?.length ?? Infinity) <= 4 && Math.max(Math.abs(i % SIZE - home % SIZE), Math.abs(Math.floor(i / SIZE) - Math.floor(home / SIZE))) <= 6 && !PETE_PROJECTS.some(p => { const project = world[p.state]; return project && project.phase !== 'complete' && [...project.tiles, ...project.spots].includes(i) }))
  const choices = TREASURES.filter(t => state.collection[t.id] < 999999)
  if (!sites.length || !choices.length) return null
  const tile = sites[Math.floor(random(state) * sites.length)], id = choices[Math.floor(random(state) * choices.length)].id
  state.pending = { id, tile }
  return { activity: 'treasureward', destination: tile }
}
export function beginLeisureWork(world: World): { activity: LeisureActivity; duration: number } | null {
  const state = world.leisure, activity = world.peace.activity
  if (!state) return null
  if (activity === 'treasureward' && state.pending?.tile === world.pete.tile) return { activity: 'pickingTreasure', duration: 1500 }
  if (activity === 'treasureHomeward' && state.carried && neighboringTiles(world.treasureProject!.tiles[0]).includes(world.pete.tile)) return { activity: 'storingTreasure', duration: 2000 }
  if (activity === 'flightward' && leisureSpot(world, 'flightpad') !== null && world.personality.paths.inventor.level >= 4) {
    const practice = world.personality.paths.inventor.level < 5
    state.flight = { startMs: world.timeMs, durationMs: practice ? 6000 : 12000, tile: world.pete.tile, pad: world.flightProject!.tiles[0], practice, crash: practice && (state.practices < 2 || random(state) < Math.max(.1, .5 - state.practices * .04)) }
    return { activity: 'flying', duration: state.flight.durationMs }
  }
  return null
}
export function finishLeisure(world: World): { activity: LeisureActivity; duration: number; destination: number | null } | null {
  const state = world.leisure
  if (!state) return null
  if (world.peace.activity === 'pickingTreasure' && state.pending && !world.buildings[state.pending.tile] && !world.water[state.pending.tile]) {
    state.carried = state.pending.id; state.pending = null
    const spot = leisureSpot(world, 'treasure')
    return spot === null ? null : { activity: 'treasureHomeward', duration: 0, destination: spot }
  }
  if (world.peace.activity === 'storingTreasure' && state.carried && leisureSpot(world, 'treasure') !== null) {
    state.collection[state.carried]++; state.carried = null
    awardActivity(world.personality, { path: 'inventor', xp: 1 })
  }
  if (world.peace.activity === 'flying' && state.flight?.crash) return { activity: 'crashRest', duration: 2000, destination: null }
  if ((world.peace.activity === 'flying' || world.peace.activity === 'crashRest') && state.flight) {
    if (state.flight.practice) { state.practices++; awardActivity(world.personality, { path: 'inventor', xp: PRACTICE_XP }) }
    state.flight = null; state.nextFlightAtMs = world.timeMs + FLIGHT_COOLDOWN_MS
  }
  return null
}
export function refreshLeisure(world: World): void {
  const state = world.leisure, activity = world.peace.activity
  if (state && world.peace.home === null) { state.pending = null; state.flight = null }
  if (!state || !LEISURE_ACTIVITIES.includes(activity)) return
  const target = world.peace.destination
  const invalid = world.peace.home === null || (['flightward', 'flying', 'crashRest'].includes(activity) ? leisureSpot(world, 'flightpad') === null : ['treasureHomeward', 'storingTreasure'].includes(activity) ? leisureSpot(world, 'treasure') === null : !state.pending || !!world.buildings[state.pending.tile] || world.water[state.pending.tile]) || (target !== null && (world.water[target] || !!world.buildings[target] && !serviceCrossing(world, target)))
  if (!invalid) return
  state.pending = null
  if (state.flight) state.nextFlightAtMs = world.timeMs + FLIGHT_COOLDOWN_MS
  state.flight = null
  Object.assign(world.pete, { next: null, travelMs: 0, x: world.pete.tile % SIZE, y: Math.floor(world.pete.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(world.peace, { activity: 'homeward', sinceMs: world.timeMs, untilMs: world.timeMs, destination: null })
}
export function flightPose(world: World): Position | null {
  const flight = world.leisure?.flight
  if (!flight || world.peace.activity !== 'flying') return null
  const t = Math.min(1, Math.max(0, (world.timeMs - flight.startMs) / flight.durationMs)), radius = flight.practice ? .65 : 2.5
  const hx = flight.tile % SIZE, hy = Math.floor(flight.tile / SIZE)
  return { x: Math.max(0, Math.min(SIZE - 1, hx + Math.sin(t * Math.PI * 2) * radius)), y: Math.max(0, Math.min(SIZE - 1, hy + (1 - Math.cos(t * Math.PI * 2)) * radius * .4 - Math.sin(t * Math.PI) * 1.6)) }
}
