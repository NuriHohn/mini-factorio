import { restoreWater, validateTerrain } from './terrainValidation'
import { createPeace } from '../simulation/peace'
import { restorePeace } from './peaceValidation'
import { createNature, refreshNatureSchedule } from '../simulation/nature'
import { restoreNature } from './natureValidation'
import type { NatureData } from './natureValidation'
import { createRevenge, restoreRevenge } from './revengeValidation'
import { createResearch, SPRINT11_TECHNOLOGIES, TECHNOLOGIES, TECHNOLOGY_IDS } from '../simulation/research'
import type { ResearchState } from '../simulation/research'
import { createAnalytics, restoreAnalytics } from './analyticsValidation'
import { createWebs, MAX_GROUND_WEBS, WEB_FLIGHT_MS, WEB_LIFETIME_MS, peteWebTile } from '../simulation/webs'
import { isSabotageable } from '../simulation/buildingCapabilities'
import { SPRAY_MS, SLIP_MS, COMPLAIN_MS, WATER_FLEE_MS, WATER_COMPLAINTS } from '../simulation/sprinklers'
import { allocatePower } from '../simulation/power'
import { RESOURCES } from '../simulation/items'
import { edgeTile, neighboringTiles } from '../simulation/navigation'
import { ARREST_MS, LEGACY_ARREST_MS, arrestDuration, POLICE_TILE_MS } from '../simulation/police'
import type { PoliceCar } from '../simulation/police'
import { PETE_FLEE_MS, PETE_WALK_MS } from '../simulation/pete'
import type { Pete } from '../simulation/pete'
import { SIZE } from '../simulation/world'
import type { Direction, Prison, World } from '../simulation/world'
import * as v from './validation'

export const SAVE_FORMAT = 'mini-factorio-save'
export const SAVE_VERSION = 11
export const MAX_SAVE_BYTES = 2 * 1024 * 1024
export interface ViewState { scrollX: number; scrollY: number; zoom: number; direction: Direction; powerOverlay: boolean }
export interface LoadedGame { world: World; view: ViewState; savedAt: string }
type PeteData = Omit<Pete, 'prison' | 'pumpkin'> & { prison: number | null; pumpkin: (Omit<NonNullable<Pete['pumpkin']>, 'target'> & { target: number }) | null }
type PoliceData = { car: (Omit<PoliceCar, 'prison'> & { prison: number }) | null; flash: World['police']['flash']; retryAtMs: number }
export interface SaveDocument {
  format: typeof SAVE_FORMAT
  version: typeof SAVE_VERSION
  savedAt: string
  map: { width: number; height: number }
  game: Omit<World, 'pete' | 'police' | 'power' | 'nature'> & { nature: NatureData; pete: PeteData; police: PoliceData }
  view: ViewState
}
function restoreResearch(value: unknown, version: number): ResearchState {
  const r = v.object(value, 'game.research', ['balanceUnits', 'unlocked'])
  if (typeof r.balanceUnits !== 'string' || !/^(0|[1-9][0-9]{0,39})$/.test(r.balanceUnits)) v.invalid('research.balanceUnits', 'expected a nonnegative canonical integer string')
  const ids = version >= 6 ? TECHNOLOGY_IDS : SPRINT11_TECHNOLOGIES
  const unlocked = v.array(r.unlocked, 'research.unlocked', undefined, ids.length).map(id => v.choice(id, 'research.unlocked', ids))
  if (!unlocked.includes('basicIndustry') || new Set(unlocked).size !== unlocked.length) v.invalid('research.unlocked', 'missing Basic Industry or duplicate technology')
  for (const id of unlocked) {
    const prerequisite = TECHNOLOGIES[id].prerequisite
    if (prerequisite && !unlocked.includes(prerequisite)) v.invalid('research.unlocked', 'missing technology prerequisite')
  }
  return { balanceUnits: r.balanceUnits, unlocked }
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) v.invalid('savedAt', 'expected an ISO timestamp')
  return value
}
function prisonReference(value: unknown, world: World, path: string): Prison {
  const index = v.tile(value, path), prison = world.buildings[index]
  if (prison?.kind !== 'prison') v.invalid(path, 'missing prison building reference')
  return prison
}
function path(value: unknown, name: string): number[] { return v.array(value, name).map((tile, i) => v.tile(tile, `${name}[${i}]`)) }
function revision(value: unknown, name: string, world: World): number { return v.number(value, name, -1, world.topologyRevision, true) }
function effect(value: unknown, name: string, world: World, duration: number): { position: { x: number; y: number }; untilMs: number } | null {
  if (value === null) return null
  const r = v.object(value, name, ['position', 'untilMs'])
  return { position: v.position(r.position, `${name}.position`), untilMs: v.count(r.untilMs, `${name}.untilMs`, world.timeMs + duration) }
}
function restorePete(value: unknown, world: World, version: number): Pete {
  const p = v.object(value, 'game.pete', ['x', 'y', 'mode', 'prison', 'imprisonedAtMs', 'graceUntilMs', 'jailbreak', 'tile', 'next', 'travelMs', 'seed', 'cooldownMs', 'cryingMs', 'escape', 'path', 'pathRevision', 'webMs', 'pumpkin', ...(version === 1 ? [] : ['water']), ...(version < 3 ? [] : ['trappedBy', 'ignoredWebs'])])
  const oldModes = ['WANDERING', 'FLEEING', 'CRYING', 'ARRESTED', 'TRANSPORTED', 'IMPRISONED'] as const
  const mode = v.choice(p.mode, 'pete.mode', version === 1 ? oldModes : [...oldModes, 'SPRAYED', 'SLIPPING', 'COMPLAINING', 'WATER_FLEEING', ...(version < 3 ? [] : ['TRAPPED'] as const)] as const)
  let water: Pete['water'] = null
  if (version !== 1 && p.water !== null) {
    const w = v.object(p.water, 'pete.water', ['origin', 'source', 'remainingMs', 'complaint'])
    const limit = mode === 'SPRAYED' ? SPRAY_MS : mode === 'SLIPPING' ? SLIP_MS : mode === 'COMPLAINING' ? COMPLAIN_MS : WATER_FLEE_MS
    water = { origin: v.position(w.origin, 'water.origin'), source: w.source === null ? null : v.tile(w.source, 'water.source'), remainingMs: v.number(w.remainingMs, 'water.remainingMs', 50, limit), complaint: v.count(w.complaint, 'water.complaint', WATER_COMPLAINTS.length - 1) }
    if (water.remainingMs % 50 !== 0 || !Number.isInteger(water.origin.x) || !Number.isInteger(water.origin.y)) v.invalid('water', 'invalid timer boundary or sprinkler position')
  }
  let pumpkin: Pete['pumpkin'] = null
  if (p.pumpkin !== null) {
    const shot = v.object(p.pumpkin, 'pete.pumpkin', ['target', 'index', 'from', 'elapsedMs'])
    const index = v.tile(shot.index, 'pumpkin.index'), target = world.buildings[v.tile(shot.target, 'pumpkin.target')]
    if (!target || !isSabotageable(target) || (version < 3 && !['miner', 'furnace', 'assembler'].includes(target.kind)) || index !== target.y * SIZE + target.x) v.invalid('pumpkin.target', 'invalid production target reference')
    pumpkin = { target, index, from: v.position(shot.from, 'pumpkin.from'), elapsedMs: v.number(shot.elapsedMs, 'pumpkin.elapsedMs', 0, 399.999) }
  }
  return {
    ...v.position({ x: p.x, y: p.y }, 'pete'), mode, water,
    trappedBy: version < 3 || p.trappedBy === null ? null : v.count(p.trappedBy, 'pete.trappedBy'),
    ignoredWebs: version < 3 ? [] : v.array(p.ignoredWebs, 'pete.ignoredWebs', undefined, MAX_GROUND_WEBS).map((id, i) => v.count(id, `pete.ignoredWebs[${i}]`)),
    prison: p.prison === null ? null : prisonReference(p.prison, world, 'pete.prison'),
    imprisonedAtMs: p.imprisonedAtMs === null ? null : v.count(p.imprisonedAtMs, 'pete.imprisonedAtMs', world.timeMs),
    graceUntilMs: v.count(p.graceUntilMs, 'pete.graceUntilMs', world.timeMs + 10000), jailbreak: effect(p.jailbreak, 'pete.jailbreak', world, 1200),
    tile: v.tile(p.tile, 'pete.tile'), next: p.next === null ? null : v.tile(p.next, 'pete.next'), travelMs: v.number(p.travelMs, 'pete.travelMs', 0, (version < 3 ? 1.3 : 1) * ((mode === 'FLEEING' || mode === 'WATER_FLEEING') ? PETE_FLEE_MS : PETE_WALK_MS)) / (version < 3 ? 1.3 : 1),
    seed: v.count(p.seed, 'pete.seed', 0xffffffff), cooldownMs: v.number(p.cooldownMs, 'pete.cooldownMs', 0, 30000), cryingMs: v.number(p.cryingMs, 'pete.cryingMs', 0, 10000),
    escape: p.escape === null ? null : v.tile(p.escape, 'pete.escape'), path: path(p.path, 'pete.path'), pathRevision: revision(p.pathRevision, 'pete.pathRevision', world), webMs: v.number(p.webMs, 'pete.webMs', 0, 700), pumpkin,
  }
}
function restorePolice(value: unknown, world: World, version: number): World['police'] {
  const p = v.object(value, 'game.police', ['car', 'flash', 'retryAtMs'])
  let car: PoliceCar | null = null
  if (p.car !== null) {
    const c = v.object(p.car, 'police.car', ['x', 'y', 'tile', 'next', 'travelMs', 'path', 'pathRevision', 'target', 'phase', 'arrestElapsedMs', 'arrestFrom', 'prison'], version >= 6 ? ['arrestStartedAtMs', 'arrestDurationMs'] : [])
    if (c.arrestDurationMs !== undefined && c.arrestDurationMs !== ARREST_MS) v.invalid('car.arrestDurationMs', 'unsupported arrest sequence duration')
    car = {
      ...v.position({ x: c.x, y: c.y }, 'police.car'), tile: v.tile(c.tile, 'car.tile'), next: c.next === null ? null : v.tile(c.next, 'car.next'), travelMs: v.number(c.travelMs, 'car.travelMs', 0, POLICE_TILE_MS),
      path: path(c.path, 'car.path'), pathRevision: revision(c.pathRevision, 'car.pathRevision', world), target: v.tile(c.target, 'car.target'), phase: v.choice(c.phase, 'car.phase', ['RESPONDING', 'ARRESTING', 'TRANSPORTING'] as const),
      ...(c.arrestStartedAtMs === undefined ? {} : { arrestStartedAtMs: v.count(c.arrestStartedAtMs, 'car.arrestStartedAtMs', world.timeMs) }),
      ...(c.arrestDurationMs === undefined ? {} : { arrestDurationMs: ARREST_MS }),
      arrestElapsedMs: v.number(c.arrestElapsedMs, 'car.arrestElapsedMs', 0, c.arrestDurationMs === undefined ? LEGACY_ARREST_MS : ARREST_MS), arrestFrom: v.position(c.arrestFrom, 'car.arrestFrom'), prison: prisonReference(c.prison, world, 'car.prison'),
    }
  }
  if (car?.arrestStartedAtMs !== undefined && (car.arrestStartedAtMs % 50 !== 0 || car.phase === 'RESPONDING' || (car.phase === 'ARRESTING' && world.timeMs - car.arrestStartedAtMs !== car.arrestElapsedMs) || (car.phase === 'TRANSPORTING' && world.timeMs - car.arrestStartedAtMs < arrestDuration(car)))) v.invalid('car.arrestStartedAtMs', 'inconsistent arrest animation clock')
  if (car?.arrestDurationMs !== undefined && (car.arrestStartedAtMs === undefined || car.phase === 'RESPONDING' || car.arrestElapsedMs % 50 !== 0 || (car.phase === 'ARRESTING' && car.arrestElapsedMs === ARREST_MS) || (car.phase === 'TRANSPORTING' && car.arrestElapsedMs !== ARREST_MS))) v.invalid('car.arrestDurationMs', 'inconsistent arrest sequence')
  return { car, flash: effect(p.flash, 'police.flash', world, 350), retryAtMs: v.count(p.retryAtMs, 'police.retryAtMs', world.timeMs + 1000), radarRevision: -1, radars: [] }
}
function restoreWebs(value: unknown, timeMs: number): World['webs'] {
  const state = v.object(value, 'game.webs', ['nextId', 'patches'])
  const nextId = v.number(state.nextId, 'webs.nextId', 1, Number.MAX_SAFE_INTEGER, true)
  let previous = 0
  const patches = v.array(state.patches, 'webs.patches', undefined, MAX_GROUND_WEBS).map((entry, i) => {
    const name = `webs.patches[${i}]`, w = v.object(entry, name, ['id', 'tile', 'from', 'launchedAtMs', 'landsAtMs', 'expiresAtMs'])
    const id = v.number(w.id, `${name}.id`, 1, nextId - 1, true)
    const launchedAtMs = v.count(w.launchedAtMs, `${name}.launchedAtMs`, timeMs)
    const landsAtMs = v.count(w.landsAtMs, `${name}.landsAtMs`), expiresAtMs = v.count(w.expiresAtMs, `${name}.expiresAtMs`)
    if (id <= previous || launchedAtMs % 50 !== 0 || landsAtMs !== launchedAtMs + WEB_FLIGHT_MS || expiresAtMs !== landsAtMs + WEB_LIFETIME_MS || expiresAtMs <= timeMs) v.invalid(name, 'invalid web identity or lifetime')
    previous = id
    return { id, tile: v.tile(w.tile, `${name}.tile`), from: v.position(w.from, `${name}.from`), launchedAtMs, landsAtMs, expiresAtMs }
  })
  return { nextId, patches }
}
function validateLinks(world: World): void {
  const exits = new Set<number>(), p = world.pete, car = world.police.car
  for (const b of world.buildings) {
    if (!b) continue
    if (b.kind === 'miner' && (!world.tiles[b.y * SIZE + b.x] || (b.item && !RESOURCES.includes(b.item as typeof RESOURCES[number])))) v.invalid('miner', 'requires a deposit and ore-only output')
    if (b.sabotageUntilMs !== undefined && b.sabotageUntilMs > world.timeMs + 10000) v.invalid('sabotageUntilMs', 'disable timer exceeds ten seconds')
    if (b.kind === 'prison') {
      if (!edgeTile(b.y * SIZE + b.x) || !neighboringTiles(b.y * SIZE + b.x).includes(b.exit) || world.buildings[b.exit] || exits.has(b.exit)) v.invalid('prison.exit', 'invalid, occupied or shared exit')
      exits.add(b.exit)
    }
  }
  if ((p.mode === 'TRAPPED') !== (p.trappedBy !== null)) v.invalid('pete.trappedBy', 'trap and mode disagree')
  if (new Set(p.ignoredWebs).size !== p.ignoredWebs.length || p.ignoredWebs.some(id => !world.webs.patches.some(w => w.id === id))) v.invalid('pete.ignoredWebs', 'invalid ignored web reference')
  if (p.trappedBy !== null) {
    const web = world.webs.patches.find(w => w.id === p.trappedBy)
    if (!web || web.landsAtMs > world.timeMs || web.tile !== peteWebTile(world) || p.ignoredWebs.includes(web.id) || p.pumpkin) v.invalid('pete.trappedBy', 'invalid active trap reference')
  }
  const wetMode = ['SPRAYED', 'SLIPPING', 'COMPLAINING', 'WATER_FLEEING'].includes(p.mode)
  if (wetMode !== (p.water !== null)) v.invalid('pete.water', 'reaction and mode disagree')
  if (p.water) {
    if (car || p.pumpkin || p.webMs || world.timeMs < p.graceUntilMs) v.invalid('pete.water', 'reaction overlaps a protected state')
    const source = p.water.source === null ? null : world.buildings[p.water.source]
    if (p.mode === 'SPRAYED') {
      if (source?.kind !== 'sprinkler' || source.x !== p.water.origin.x || source.y !== p.water.origin.y || source.cooldownUntilMs > world.timeMs) v.invalid('water.source', 'invalid active sprinkler reference')
    } else if (p.water.source !== null) v.invalid('water.source', 'finished spray retains a target')
  }
  const custody = ['ARRESTED', 'TRANSPORTED', 'IMPRISONED'].includes(p.mode)
  for (const actor of [p, ...(car ? [car] : [])]) {
    // Arrest preserves Pete's old flee path, but custody never consumes it.
    let previous = actor === p && custody ? null : actor.next ?? actor.tile
    for (const tile of actor.path) {
      if (previous !== null && !neighboringTiles(previous).includes(tile)) v.invalid('path', 'navigation path skips a tile')
      previous = tile
    }
  }
  if (custody !== (p.prison !== null) || (p.mode === 'IMPRISONED') !== (p.imprisonedAtMs !== null)) v.invalid('pete', 'custody and prison state disagree')
  if (custody && (p.next !== null || p.pumpkin !== null || p.travelMs !== 0)) v.invalid('pete', 'custody contains independent movement or projectile')
  if (p.mode === 'IMPRISONED') {
    if (car || p.x !== p.prison!.x || p.y !== p.prison!.y || p.tile !== p.prison!.y * SIZE + p.prison!.x || world.timeMs - p.imprisonedAtMs! >= 60000) v.invalid('pete', 'invalid prisoner position or timer')
  } else if (!custody) {
    if (world.buildings[p.tile] || (p.next !== null && (world.buildings[p.next] || !neighboringTiles(p.tile).includes(p.next)))) v.invalid('pete', 'movement overlaps buildings or skips a tile')
    const t = p.next === null ? 0 : p.travelMs / ((p.mode === 'FLEEING' || p.mode === 'WATER_FLEEING') ? PETE_FLEE_MS : PETE_WALK_MS)
    const x = p.tile % SIZE + ((p.next ?? p.tile) % SIZE - p.tile % SIZE) * t
    const y = Math.floor(p.tile / SIZE) + (Math.floor((p.next ?? p.tile) / SIZE) - Math.floor(p.tile / SIZE)) * t
    if (Math.abs(p.x - x) > 1e-7 || Math.abs(p.y - y) > 1e-7 || (p.next === null && p.travelMs !== 0)) v.invalid('pete', 'position disagrees with movement progress')
  }
  if ((p.mode === 'ARRESTED' || p.mode === 'TRANSPORTED') && !car) v.invalid('police.car', 'missing custody transport')
  if (car) {
    if (world.buildings[car.tile] || (car.next !== null && (world.buildings[car.next] || !neighboringTiles(car.tile).includes(car.next)))) v.invalid('car', 'invalid movement occupancy')
    if ((car.phase === 'ARRESTING' && p.mode !== 'ARRESTED') || (car.phase === 'TRANSPORTING' && p.mode !== 'TRANSPORTED') || (car.phase === 'RESPONDING' && custody) || (car.phase !== 'RESPONDING' && p.prison !== car.prison)) v.invalid('car', 'phase and Pete state disagree')
    if ((car.phase === 'ARRESTING' && car.next !== null) || (car.next === null && car.travelMs !== 0)) v.invalid('car', 'invalid phase movement')
    const t = car.next === null ? 0 : car.travelMs / POLICE_TILE_MS
    if (Math.abs(car.x - (car.tile % SIZE + ((car.next ?? car.tile) % SIZE - car.tile % SIZE) * t)) > 1e-7 || Math.abs(car.y - (Math.floor(car.tile / SIZE) + (Math.floor((car.next ?? car.tile) / SIZE) - Math.floor(car.tile / SIZE)) * t)) > 1e-7) v.invalid('car', 'position disagrees with movement progress')
  }
}
export function decodeSave(text: string): LoadedGame {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SAVE_BYTES) throw new Error('Save file exceeds the 2 MiB limit.')
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('Invalid save JSON. Choose a Mini-Factorio JSON save file.') }
  const root = v.object(parsed, 'save', ['format', 'version', 'savedAt', 'map', 'game', 'view'])
  if (root.format !== SAVE_FORMAT) throw new Error('This is not a Mini-Factorio save file.')
  if (root.version !== 1 && root.version !== 2 && root.version !== 3 && root.version !== 4 && root.version !== 5 && root.version !== 6 && root.version !== 7 && root.version !== 8 && root.version !== 9 && root.version !== 10 && root.version !== SAVE_VERSION) throw new Error(`Unsupported save version ${String(root.version)}. This game supports versions 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 and ${SAVE_VERSION}.`)
  const version = root.version
  const savedAt = timestamp(root.savedAt), map = v.object(root.map, 'map', ['width', 'height'])
  if (map.width !== SIZE || map.height !== SIZE) throw new Error(`Unsupported map dimensions; this version requires ${SIZE}×${SIZE}.`)
  const data = v.object(root.game, 'game', ['timeMs', 'remainder', 'topologyRevision', 'tiles', 'buildings', 'mined', 'produced', 'pete', 'police', ...(root.version >= 3 ? ['webs'] : []), ...(root.version >= 4 ? ['analytics'] : []), ...(root.version >= 5 ? ['research'] : []), ...(root.version >= 6 ? ['revenge'] : []), ...(root.version >= 7 ? ['nature'] : []), ...(root.version >= 8 ? ['peace'] : []), ...(root.version >= 9 ? ['water'] : [])])
  const timeMs = v.count(data.timeMs, 'game.timeMs')
  if (timeMs % 50 !== 0) v.invalid('game.timeMs', 'expected a 50 ms simulation boundary')
  const tiles = v.array(data.tiles, 'game.tiles', SIZE * SIZE).map((r, i) => r === null ? null : v.choice(r, `tiles[${i}]`, RESOURCES))
  const buildings = v.array(data.buildings, 'game.buildings', SIZE * SIZE).map((b, i) => {
    const building = v.building(b, `buildings[${i}]`, i, timeMs, version)
    if (root.version === 1 && building?.kind === 'sprinkler') v.invalid(`buildings[${i}]`, 'sprinklers require save version 2')
    if (version < 3 && building?.sabotageUntilMs !== undefined && !['miner', 'furnace', 'assembler'].includes(building.kind)) v.invalid(`buildings[${i}]`, 'unsupported legacy sabotage target')
    return building
  })
  // Reconstruct into a detached candidate. No live world or storage is touched.
  const world = { water: version >= 9 ? restoreWater(data.water) : Array<boolean>(SIZE * SIZE).fill(false), peace: createPeace(), nature: version >= 7 ? restoreNature(data.nature, buildings) : createNature(), revenge: createRevenge(), research: root.version >= 5 ? restoreResearch(data.research, root.version) : createResearch(true), analytics: createAnalytics(timeMs), webs: root.version >= 3 ? restoreWebs(data.webs, timeMs) : createWebs(), timeMs, remainder: v.number(data.remainder, 'game.remainder', 0, 49.999999999), topologyRevision: v.count(data.topologyRevision, 'game.topologyRevision'), tiles, buildings, mined: v.inventory(data.mined, 'game.mined'), produced: v.inventory(data.produced, 'game.produced'), power: null } as World
  world.pete = restorePete(data.pete, world, root.version)
  world.police = restorePolice(data.police, world, root.version)
  if (root.version < 4) {
    for (const b of world.buildings) if (b?.kind === 'assembler') {
      // Preserve committed jobs and all buffered legacy stock. Provisional candidates are not selections.
      if (!b.recipeLocked) b.recipeId = null
      b.autoWaitElapsedMs = null
    }
  }
  if (root.version >= 4) world.analytics = restoreAnalytics(data.analytics, world)
  if (version >= 6) world.revenge = restoreRevenge(data.revenge, world)
  if (version >= 8) world.peace = restorePeace(data.peace, world, version)
  refreshNatureSchedule(world)
  validateLinks(world)
  validateTerrain(world)
  const rawView = v.object(root.view, 'view', ['scrollX', 'scrollY', 'zoom', 'direction', 'powerOverlay'])
  const view: ViewState = { scrollX: v.number(rawView.scrollX, 'view.scrollX', -1e7, 1e7), scrollY: v.number(rawView.scrollY, 'view.scrollY', -1e7, 1e7), zoom: v.number(rawView.zoom, 'view.zoom', .5, 2.5), direction: v.direction(rawView.direction, 'view.direction'), powerOverlay: v.boolean(rawView.powerOverlay, 'view.powerOverlay') }
  allocatePower(world)
  return { world, view, savedAt }
}
export function encodeSave(world: World, view: ViewState, savedAt = new Date().toISOString()): string {
  const prisonId = (prison: Prison | null): number | null => {
    if (!prison) return null
    const index = prison.y * SIZE + prison.x
    if (world.buildings[index] !== prison) throw new Error('Cannot save a stale prison reference.')
    return index
  }
  const shot = world.pete.pumpkin
  const document: SaveDocument = {
    format: SAVE_FORMAT, version: SAVE_VERSION, savedAt, map: { width: SIZE, height: SIZE }, view: { ...view },
    game: { water: world.water, peace: world.peace, nature: { wood: world.nature.wood, seed: world.nature.seed, decorations: world.nature.decorations }, revenge: world.revenge, research: world.research, analytics: world.analytics, webs: world.webs, timeMs: world.timeMs, remainder: world.remainder, topologyRevision: world.topologyRevision, tiles: world.tiles, buildings: world.buildings, mined: world.mined, produced: world.produced,
      pete: { ...world.pete, prison: prisonId(world.pete.prison), pumpkin: shot && world.buildings[shot.index] === shot.target ? { ...shot, target: shot.index } : null },
      police: { car: world.police.car ? { ...world.police.car, prison: prisonId(world.police.car.prison)! } : null, flash: world.police.flash, retryAtMs: world.police.retryAtMs },
    },
  }
  const text = JSON.stringify(document)
  decodeSave(text) // Validate the snapshot before any storage write or download.
  return text
}
