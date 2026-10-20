import { allocatePower } from '../simulation/power'
import { RESOURCES } from '../simulation/items'
import { edgeTile, neighboringTiles } from '../simulation/navigation'
import { ARREST_MS, POLICE_TILE_MS } from '../simulation/police'
import type { PoliceCar } from '../simulation/police'
import { PETE_FLEE_MS, PETE_WALK_MS, isProductionMachine } from '../simulation/pete'
import type { Pete } from '../simulation/pete'
import { SIZE } from '../simulation/world'
import type { Direction, Prison, World } from '../simulation/world'
import * as v from './validation'

export const SAVE_FORMAT = 'mini-factorio-save'
export const SAVE_VERSION = 1
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
  game: Omit<World, 'pete' | 'police' | 'power'> & { pete: PeteData; police: PoliceData }
  view: ViewState
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
function restorePete(value: unknown, world: World): Pete {
  const p = v.object(value, 'game.pete', ['x', 'y', 'mode', 'prison', 'imprisonedAtMs', 'graceUntilMs', 'jailbreak', 'tile', 'next', 'travelMs', 'seed', 'cooldownMs', 'cryingMs', 'escape', 'path', 'pathRevision', 'webMs', 'pumpkin'])
  const mode = v.choice(p.mode, 'pete.mode', ['WANDERING', 'FLEEING', 'CRYING', 'ARRESTED', 'TRANSPORTED', 'IMPRISONED'] as const)
  let pumpkin: Pete['pumpkin'] = null
  if (p.pumpkin !== null) {
    const shot = v.object(p.pumpkin, 'pete.pumpkin', ['target', 'index', 'from', 'elapsedMs'])
    const index = v.tile(shot.index, 'pumpkin.index'), target = world.buildings[v.tile(shot.target, 'pumpkin.target')]
    if (!target || !isProductionMachine(target) || index !== target.y * SIZE + target.x) v.invalid('pumpkin.target', 'invalid production target reference')
    pumpkin = { target, index, from: v.position(shot.from, 'pumpkin.from'), elapsedMs: v.number(shot.elapsedMs, 'pumpkin.elapsedMs', 0, 399.999) }
  }
  return {
    ...v.position({ x: p.x, y: p.y }, 'pete'), mode,
    prison: p.prison === null ? null : prisonReference(p.prison, world, 'pete.prison'),
    imprisonedAtMs: p.imprisonedAtMs === null ? null : v.count(p.imprisonedAtMs, 'pete.imprisonedAtMs', world.timeMs),
    graceUntilMs: v.count(p.graceUntilMs, 'pete.graceUntilMs', world.timeMs + 10000), jailbreak: effect(p.jailbreak, 'pete.jailbreak', world, 1200),
    tile: v.tile(p.tile, 'pete.tile'), next: p.next === null ? null : v.tile(p.next, 'pete.next'), travelMs: v.number(p.travelMs, 'pete.travelMs', 0, mode === 'FLEEING' ? PETE_FLEE_MS : PETE_WALK_MS),
    seed: v.count(p.seed, 'pete.seed', 0xffffffff), cooldownMs: v.number(p.cooldownMs, 'pete.cooldownMs', 0, 30000), cryingMs: v.number(p.cryingMs, 'pete.cryingMs', 0, 10000),
    escape: p.escape === null ? null : v.tile(p.escape, 'pete.escape'), path: path(p.path, 'pete.path'), pathRevision: revision(p.pathRevision, 'pete.pathRevision', world), webMs: v.number(p.webMs, 'pete.webMs', 0, 700), pumpkin,
  }
}
function restorePolice(value: unknown, world: World): World['police'] {
  const p = v.object(value, 'game.police', ['car', 'flash', 'retryAtMs'])
  let car: PoliceCar | null = null
  if (p.car !== null) {
    const c = v.object(p.car, 'police.car', ['x', 'y', 'tile', 'next', 'travelMs', 'path', 'pathRevision', 'target', 'phase', 'arrestElapsedMs', 'arrestFrom', 'prison'])
    car = {
      ...v.position({ x: c.x, y: c.y }, 'police.car'), tile: v.tile(c.tile, 'car.tile'), next: c.next === null ? null : v.tile(c.next, 'car.next'), travelMs: v.number(c.travelMs, 'car.travelMs', 0, POLICE_TILE_MS),
      path: path(c.path, 'car.path'), pathRevision: revision(c.pathRevision, 'car.pathRevision', world), target: v.tile(c.target, 'car.target'), phase: v.choice(c.phase, 'car.phase', ['RESPONDING', 'ARRESTING', 'TRANSPORTING'] as const),
      arrestElapsedMs: v.number(c.arrestElapsedMs, 'car.arrestElapsedMs', 0, ARREST_MS), arrestFrom: v.position(c.arrestFrom, 'car.arrestFrom'), prison: prisonReference(c.prison, world, 'car.prison'),
    }
  }
  return { car, flash: effect(p.flash, 'police.flash', world, 350), retryAtMs: v.count(p.retryAtMs, 'police.retryAtMs', world.timeMs + 1000), radarRevision: -1, radars: [] }
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
    const t = p.next === null ? 0 : p.travelMs / (p.mode === 'FLEEING' ? PETE_FLEE_MS : PETE_WALK_MS)
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
  if (root.version !== SAVE_VERSION) throw new Error(`Unsupported save version ${String(root.version)}. This game supports version ${SAVE_VERSION}.`)
  const savedAt = timestamp(root.savedAt), map = v.object(root.map, 'map', ['width', 'height'])
  if (map.width !== SIZE || map.height !== SIZE) throw new Error(`Unsupported map dimensions; this version requires ${SIZE}×${SIZE}.`)
  const data = v.object(root.game, 'game', ['timeMs', 'remainder', 'topologyRevision', 'tiles', 'buildings', 'mined', 'produced', 'pete', 'police'])
  const timeMs = v.count(data.timeMs, 'game.timeMs')
  if (timeMs % 50 !== 0) v.invalid('game.timeMs', 'expected a 50 ms simulation boundary')
  const tiles = v.array(data.tiles, 'game.tiles', SIZE * SIZE).map((r, i) => r === null ? null : v.choice(r, `tiles[${i}]`, RESOURCES))
  const buildings = v.array(data.buildings, 'game.buildings', SIZE * SIZE).map((b, i) => v.building(b, `buildings[${i}]`, i, timeMs))
  // Reconstruct into a detached candidate. No live world or storage is touched.
  const world = { timeMs, remainder: v.number(data.remainder, 'game.remainder', 0, 49.999999999), topologyRevision: v.count(data.topologyRevision, 'game.topologyRevision'), tiles, buildings, mined: v.inventory(data.mined, 'game.mined'), produced: v.inventory(data.produced, 'game.produced'), power: null } as World
  world.pete = restorePete(data.pete, world)
  world.police = restorePolice(data.police, world)
  validateLinks(world)
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
    game: { timeMs: world.timeMs, remainder: world.remainder, topologyRevision: world.topologyRevision, tiles: world.tiles, buildings: world.buildings, mined: world.mined, produced: world.produced,
      pete: { ...world.pete, prison: prisonId(world.pete.prison), pumpkin: shot && world.buildings[shot.index] === shot.target ? { ...shot, target: shot.index } : null },
      police: { car: world.police.car ? { ...world.police.car, prison: prisonId(world.police.car.prison)! } : null, flash: world.police.flash, retryAtMs: world.police.retryAtMs },
    },
  }
  const text = JSON.stringify(document)
  decodeSave(text) // Validate the snapshot before any storage write or download.
  return text
}
