import { neighboringTiles, reachableTiles, tilePath } from './navigation'
import { PETE_COOLDOWN_MS, PETE_WALK_MS } from './pete'
import { WARNING_MS } from './revenge'
import { SIZE } from './world'
import type { Position, World } from './world'

export const TREEHOUSE_WOOD = 20
export const GIFT_MIN_MS = 300000
export const GIFT_MAX_MS = 600000
export const MAX_GIFTS = 3
export const PEACE_ACTIVITIES = ['homeward', 'entering', 'resting', 'walking', 'waving', 'flowers'] as const
export type PeaceActivity = typeof PEACE_ACTIVITIES[number]
export interface Gift { id: number; tile: number; kind: 'wood' | 'flowers'; wood: number; atMs: number }
export interface PeaceState {
  home: number | null
  activity: PeaceActivity
  sinceMs: number
  untilMs: number
  destination: number | null
  nextGiftAtMs: number
  nextId: number
  seed: number
  gifts: Gift[]
  shutdown: { position: Position; atMs: number } | null
  reactionAtMs: number | null
}
export function createPeace(): PeaceState {
  return { home: null, activity: 'homeward', sinceMs: 0, untilMs: 0, destination: null, nextGiftAtMs: 0, nextId: 1, seed: 0x686f6d65, gifts: [], shutdown: null, reactionAtMs: null }
}
export function peaceful(world: World): boolean { return world.peace.home !== null }
function random(world: World): number {
  const p = world.peace
  p.seed = (Math.imul(1664525, p.seed) + 1013904223) >>> 0
  return p.seed / 4294967296
}
function scheduleGift(world: World): void {
  world.peace.nextGiftAtMs = world.timeMs + GIFT_MIN_MS + Math.floor(random(world) * ((GIFT_MAX_MS - GIFT_MIN_MS) / 50 + 1)) * 50
}
function reserved(world: World, tile: number): boolean {
  return world.buildings.some(b => b?.kind === 'prison' && b.exit === tile)
}
function resetPete(world: World): void {
  const p = world.pete
  // Custody can place Pete on a prison tile; choose the nearest free legal cell.
  const origin = p.tile
  const tile = world.buildings.flatMap((b, i) => !b && !world.water[i] ? [i] : []).sort((a, b) => Math.abs(a % SIZE - origin % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(origin / SIZE)) - Math.abs(b % SIZE - origin % SIZE) - Math.abs(Math.floor(b / SIZE) - Math.floor(origin / SIZE)) || a - b)[0]
  Object.assign(p, { tile, x: tile % SIZE, y: Math.floor(tile / SIZE), next: null, travelMs: 0, mode: 'WANDERING', prison: null, imprisonedAtMs: null, graceUntilMs: world.timeMs, jailbreak: null, pumpkin: null, webMs: 0, water: null, trappedBy: null, ignoredWebs: [], path: [], pathRevision: -1, escape: null, cryingMs: 0, cooldownMs: PETE_COOLDOWN_MS })
  world.police.car = null; world.police.flash = null; world.police.retryAtMs = 0
}
function activity(world: World, name: PeaceActivity, duration = 0): void {
  Object.assign(world.peace, { activity: name, sinceMs: world.timeMs, untilMs: world.timeMs + duration, destination: null })
  world.pete.path = []; world.pete.pathRevision = -1
}
export function beginPeace(world: World, home: number): void {
  if (peaceful(world) || world.buildings[home]?.kind !== 'treehouse') return
  const r = world.revenge
  world.peace.home = home
  if (r.boss) {
    world.peace.shutdown = { position: { x: r.boss.x, y: r.boss.y }, atMs: world.timeMs }
    world.pete.tile = r.boss.tile // Emerge from the walker, not Pete's frozen pre-flight tile.
  }
  // Cancel the encounter, never invoke combat defeat (which changes escalation).
  if (r.stage !== 'idle') { r.stage = r.arrests >= r.threshold ? 'warning' : 'idle'; r.untilMs = r.stage === 'warning' ? world.timeMs + WARNING_MS : 0 }
  r.boss = null; r.blast = null
  resetPete(world)
  activity(world, 'homeward')
  world.peace.reactionAtMs = null
  scheduleGift(world)
}
export function endPeace(world: World): void {
  if (!peaceful(world)) return
  Object.assign(world.peace, { home: null, gifts: [], nextGiftAtMs: 0, shutdown: null, reactionAtMs: world.timeMs })
  resetPete(world)
  activity(world, 'homeward')
  if (world.revenge.stage === 'warning') world.revenge.untilMs = world.timeMs + WARNING_MS
}
function localTiles(world: World, parents: Map<number, number>): number[] {
  const home = world.peace.home!
  return [...parents.keys()].filter(i => !world.water[i] && !world.buildings[i] && !reserved(world, i) && Math.max(Math.abs(i % SIZE - home % SIZE), Math.abs(Math.floor(i / SIZE) - Math.floor(home / SIZE))) <= 3)
}
function plan(world: World): void {
  const p = world.pete, s = world.peace, parents = reachableTiles(world, p.tile)
  const local = localTiles(world, parents)
  const entrances = neighboringTiles(s.home!).filter(i => parents.has(i) && !world.water[i] && !world.buildings[i] && !reserved(world, i))
  if (s.activity === 'homeward') {
    const candidates = entrances.length ? entrances : local.length ? local : [p.tile]
    s.destination = candidates.sort((a, b) => (tilePath(parents, a)?.length ?? Infinity) - (tilePath(parents, b)?.length ?? Infinity) || a - b)[0]
  } else s.destination = local.length ? local[Math.floor(random(world) * local.length)] : p.tile
  p.path = tilePath(parents, s.destination!) ?? []
  p.pathRevision = world.topologyRevision
}
function move(world: World, delta: number): void {
  const p = world.pete
  let remaining = delta
  while (remaining > 1e-8) {
    if (p.next === null) {
      if (p.pathRevision !== world.topologyRevision || world.peace.destination === null) plan(world)
      p.next = p.path.shift() ?? null
      if (p.next === null) {
        if (world.peace.activity === 'homeward') {
          if (neighboringTiles(world.peace.home!).includes(p.tile)) activity(world, 'entering', 3000)
          else activity(world, 'waving', 4000) // Enclosed home: wait, then retry after obstacles change.
        } else activity(world, random(world) < .5 ? 'flowers' : 'waving', 5000)
        return
      }
    }
    const spent = Math.min(PETE_WALK_MS - p.travelMs, remaining)
    p.travelMs += spent; remaining -= spent
    const t = p.travelMs / PETE_WALK_MS
    p.x = p.tile % SIZE + (p.next % SIZE - p.tile % SIZE) * t
    p.y = Math.floor(p.tile / SIZE) + (Math.floor(p.next / SIZE) - Math.floor(p.tile / SIZE)) * t
    if (p.travelMs >= PETE_WALK_MS - 1e-8) { p.tile = p.next; p.next = null; p.travelMs = 0 }
  }
}
function spawnGift(world: World): void {
  const s = world.peace
  if (s.gifts.length >= MAX_GIFTS || s.nextId === Number.MAX_SAFE_INTEGER) return
  const tiles = localTiles(world, reachableTiles(world, world.pete.tile)).filter(i => i !== world.pete.tile && i !== world.pete.next && !s.gifts.some(g => g.tile === i))
  if (!tiles.length) return
  const tile = tiles[Math.floor(random(world) * tiles.length)], flowers = random(world) < 1 / 3
  s.gifts.push({ id: s.nextId++, tile, kind: flowers ? 'flowers' : 'wood', wood: flowers ? 0 : 1 + Math.floor(random(world) * 2), atMs: world.timeMs })
}
export function collectGift(world: World, tile: number): string | null {
  if (!peaceful(world) || world.buildings[tile]) return null
  const s = world.peace, gift = s.gifts.find(g => g.tile === tile)
  if (!gift || !Number.isSafeInteger(world.nature.wood + gift.wood)) return null
  s.gifts = s.gifts.filter(g => g.id !== gift.id)
  if (gift.kind === 'wood') { world.nature.wood += gift.wood; return `Thanks, Pete! +${gift.wood} Wood` }
  world.nature.decorations[tile] = 'flowers'; world.nature.decorationRevision++
  return 'A bouquet from Pete! Flowers planted with love.'
}
export function advancePeace(world: World, delta: number): void {
  const s = world.peace, p = world.pete
  if (s.shutdown && world.timeMs - s.shutdown.atMs >= 6000) s.shutdown = null
  if (s.reactionAtMs !== null && world.timeMs - s.reactionAtMs >= 4000) s.reactionAtMs = null
  if (!peaceful(world)) return
  if (world.timeMs >= s.nextGiftAtMs) { spawnGift(world); scheduleGift(world) }
  if (s.activity === 'homeward' || s.activity === 'walking') {
    if (p.next !== null && (world.water[p.next] || world.buildings[p.next])) { p.next = null; p.travelMs = 0; p.x = p.tile % SIZE; p.y = Math.floor(p.tile / SIZE); p.pathRevision = -1 }
    move(world, delta)
  } else if (world.timeMs >= s.untilMs) {
    if (s.activity === 'entering') activity(world, 'resting', 12000)
    else if (s.activity === 'resting') activity(world, 'walking')
    else activity(world, 'homeward')
  }
}
