import { PROJECT_REWARDS } from '../simulation/personality'
import { PRACTICE_XP, TREASURES, LEISURE_ACTIVITIES, leisureSpot } from '../simulation/peteLeisure'
import type { PeteLeisure, TreasureId } from '../simulation/peteLeisure'
import { neighboringTiles } from '../simulation/navigation'
import type { SecretProject } from '../simulation/secretProject'
import { projectBuildMs, projectResources } from '../simulation/secretProject'
import { restoreProjectSelection } from './projectValidation'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restoreInventorProject(value: unknown, world: World, kind: 'treasure' | 'flightpad'): SecretProject | undefined {
  if (value === undefined) return undefined
  const r = v.object(value, `game.${kind}Project`, ['kind', 'home', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'elapsedMs', 'carriedCopper', 'carriedCable', 'carriedCircuits'], ['selected'])
  if (r.kind !== kind) v.invalid(kind, 'wrong project kind')
  const tiles = v.array(r.tiles, `${kind}.tiles`, 1).map(x => v.tile(x, `${kind}.tile`)), spots = v.array(r.spots, `${kind}.spots`, 1).map(x => v.tile(x, `${kind}.spot`))
  const phase = v.choice(r.phase, `${kind}.phase`, ['collecting', 'building', 'complete'] as const), home = v.tile(r.home, `${kind}.home`)
  const p: SecretProject = { kind, ...restoreProjectSelection(r), home, direction: v.choice(r.direction, `${kind}.direction`, ['east', 'south'] as const), tiles, spots, phase, crate: r.crate === null ? null : v.tile(r.crate, `${kind}.crate`), built: v.count(r.built, `${kind}.built`, 1), carried: v.count(r.carried, `${kind}.carried`, 0), elapsedMs: v.count(r.elapsedMs, `${kind}.elapsedMs`, kind === 'treasure' ? 11950 : 17950) }
  const distance = Math.abs(tiles[0] % SIZE - home % SIZE) + Math.abs(Math.floor(tiles[0] / SIZE) - Math.floor(home / SIZE))
  if (distance < 2 || distance > 6 || (tiles[0] % SIZE !== home % SIZE && Math.floor(tiles[0] / SIZE) !== Math.floor(home / SIZE)) || !neighboringTiles(tiles[0]).includes(spots[0]) || p.elapsedMs % 50 || (phase === 'complete' ? p.built !== 1 || p.crate !== null || p.elapsedMs !== 0 : p.built !== 0) || (phase === 'collecting' && p.elapsedMs !== 0) || (phase === 'building' && p.crate !== null) || (p.crate !== null && world.buildings[p.crate]?.kind !== 'supplyCrate')) v.invalid(kind, 'invalid geometry, source or work phase')
  const costs = projectResources(p)
  p.carriedCopper = v.count(r.carriedCopper, `${kind}.carriedCopper`, costs.copperPlate)
  p.carriedCable = v.count(r.carriedCable, `${kind}.carriedCable`, costs.copperCable)
  p.carriedCircuits = v.count(r.carriedCircuits, `${kind}.carriedCircuits`, costs.electronicCircuit ?? 0)
  if (p.carriedCopper !== (phase === 'building' ? costs.copperPlate : 0) || p.carriedCable !== (phase === 'building' ? costs.copperCable : 0) || p.carriedCircuits !== (phase === 'building' ? costs.electronicCircuit ?? 0 : 0) || p.elapsedMs >= projectBuildMs(p)) v.invalid(kind, 'invalid paid material accounting')
  return p
}
export function restoreLeisure(value: unknown, world: World): PeteLeisure | undefined {
  if (value === undefined) { if (LEISURE_ACTIVITIES.includes(world.peace.activity)) v.invalid('leisure', 'missing activity state'); return undefined }
  const r = v.object(value, 'game.leisure', ['seed', 'collection', 'pending', 'carried', 'nextFindAtMs', 'nextFlightAtMs', 'practices', 'flight'])
  const ids = TREASURES.map(t => t.id), collection = v.object(r.collection, 'leisure.collection', ids)
  const count = (key: TreasureId) => v.count(collection[key], `leisure.collection.${key}`, 999999)
  const clock = (value: unknown, name: string, max: number) => { const n = v.count(value, name, max); if (n % 50) v.invalid(name, 'expected a fixed-step clock'); return n }
  const state: PeteLeisure = { seed: v.count(r.seed, 'leisure.seed', 0xffffffff), collection: { stone: count('stone'), feather: count('feather'), relic: count('relic'), coin: count('coin'), crystal: count('crystal') }, pending: null, carried: r.carried === null ? null : v.choice(r.carried, 'leisure.carried', ids), nextFindAtMs: clock(r.nextFindAtMs, 'leisure.nextFindAtMs', world.timeMs + 180000), nextFlightAtMs: clock(r.nextFlightAtMs, 'leisure.nextFlightAtMs', world.timeMs + 30000), practices: v.count(r.practices, 'leisure.practices', 1000000), flight: null }
  if (r.pending !== null) {
    const pending = v.object(r.pending, 'leisure.pending', ['id', 'tile'])
    state.pending = { id: v.choice(pending.id, 'leisure.pending.id', ids), tile: v.tile(pending.tile, 'leisure.pending.tile') }
    const home = world.peace.home
    if (home === null || Math.max(Math.abs(state.pending.tile % SIZE - home % SIZE), Math.abs(Math.floor(state.pending.tile / SIZE) - Math.floor(home / SIZE))) > 6 || world.buildings[state.pending.tile] || world.water[state.pending.tile]) v.invalid('leisure.pending', 'invalid nearby find site')
  }
  if (r.flight !== null) {
    const f = v.object(r.flight, 'leisure.flight', ['startMs', 'durationMs', 'tile', 'pad', 'practice', 'crash'])
    state.flight = { startMs: clock(f.startMs, 'leisure.flight.startMs', world.timeMs), durationMs: v.number(f.durationMs, 'leisure.flight.durationMs', 6000, 12000, true), tile: v.tile(f.tile, 'leisure.flight.tile'), pad: v.tile(f.pad, 'leisure.flight.pad'), practice: v.boolean(f.practice, 'leisure.flight.practice'), crash: v.boolean(f.crash, 'leisure.flight.crash') }
    const flight = state.flight, activity = world.peace.activity
    if (!['flying', 'crashRest'].includes(activity) || flight.tile !== world.pete.tile || world.flightProject?.tiles[0] !== flight.pad || flight.durationMs !== (flight.practice ? 6000 : 12000) || (!flight.practice && flight.crash) || (activity === 'flying' ? world.peace.sinceMs !== flight.startMs || world.peace.untilMs !== flight.startMs + flight.durationMs : !flight.crash || world.peace.sinceMs !== flight.startMs + flight.durationMs)) v.invalid('leisure.flight', 'invalid flight origin, stage or clock')
  }
  const activity = world.peace.activity, destination = world.peace.destination
  if ((!!state.pending) !== ['treasureward', 'pickingTreasure'].includes(activity) || (!!state.flight) !== ['flying', 'crashRest'].includes(activity) || (state.carried && state.pending)) v.invalid('leisure', 'activity and payload disagree')
  if (state.pending && destination !== state.pending.tile) v.invalid('leisure.pending', 'find destination disagrees')
  if (['pickingTreasure', 'storingTreasure'].includes(activity) && destination !== world.pete.tile) v.invalid('leisure', 'work is away from destination')
  if (['treasureHomeward', 'storingTreasure'].includes(activity) && (!state.carried || world.treasureProject?.phase !== 'complete' || !neighboringTiles(world.treasureProject.tiles[0]).includes(destination!) || world.buildings[world.treasureProject.tiles[0]]?.kind !== 'peteTreasure')) v.invalid('leisure', 'missing chest or carried treasure')
  if (activity === 'flightward' && (!world.flightProject || !neighboringTiles(world.flightProject.tiles[0]).includes(destination!))) v.invalid('leisure', 'invalid flight approach')
  return state
}
export function validateLeisure(world: World): void {
  for (const [kind, project, level] of [['peteTreasure', world.treasureProject, 2], ['peteFlightpad', world.flightProject, 4]] as const) {
    if (world.buildings.some((b, i) => b?.kind === kind && (project?.phase !== 'complete' || project.tiles[0] !== i)) || (project && world.personality.paths.inventor.level < level)) v.invalid(kind, 'structure ownership or Inventor level disagrees')
  }
  if (world.flightProject && world.experimentProject?.phase !== 'complete') v.invalid('flightProject', 'requires completed experiment table')
  const state = world.leisure
  if (!state) return
  if (state.carried && state.collection[state.carried] >= 999999) v.invalid('leisure', 'carried treasure exceeds collection capacity')
  const total = Object.values(state.collection).reduce((a, b) => a + b, 0)
  if ((state.carried || state.pending || total) && world.treasureProject?.phase !== 'complete') v.invalid('leisure', 'treasures require completed chest')
  if ((state.practices || state.flight || world.peace.activity === 'flightward') && world.flightProject?.phase !== 'complete') v.invalid('leisure', 'flight requires completed workshop')
  if ((state.flight || world.peace.activity === 'flightward') && leisureSpot(world, 'flightpad') === null) v.invalid('leisure.flight', 'requires a safe owned workshop approach')
  if (state.flight && world.personality.paths.inventor.level < (state.flight.practice ? 4 : 5)) v.invalid('leisure.flight', 'flight not unlocked')
  const projectXp = world.personality.rewardedProjects.reduce((sum, id) => sum + (PROJECT_REWARDS[id].path === 'inventor' ? PROJECT_REWARDS[id].xp : 0), 0)
  if (world.personality.paths.inventor.xp < projectXp + total + state.practices * PRACTICE_XP) v.invalid('leisure', 'missing completion XP')
}
