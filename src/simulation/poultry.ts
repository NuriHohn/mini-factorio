import { awardActivity, EGG_REWARD } from './personality'
import { enclosedYard, yardInterior } from './yard'
import { neighboringTiles, peteReachableTiles as reachableTiles, tilePath } from './navigation'
import { SIZE } from './world'
import type { World } from './world'
export const CHICK_DELAY_MS = 150000
export const MAX_EGGS = 4
export const EGG_COLLECT_MS = 1500
export interface Bird {
  id: number
  kind: 'adult' | 'chick'
  mode: 'inside' | 'walking' | 'pecking'
  tile: number | null
  next: number | null
  travelMs: number
  untilMs: number
  facing: 'east' | 'west'
}
export interface Egg { id: number; tile: number; laidAtMs: number; laidBy: number }
export interface Poultry {
  coop: number
  populatedAtMs: number
  chicksAtMs: number
  chicksSpawned: boolean
  birds: Bird[]
  eggs: Egg[]
  nextEggAtMs: number
  nextEggId: number
  eaten: number
  collected: number
  seed: number
}
export function poultryBedtime(world: World): boolean { return world.peace.home !== null && ['entering', 'resting'].includes(world.peace.activity) }
export function poultryActive(world: World): boolean {
  const s = world.poultry
  return !!s && world.coopProject?.phase === 'complete' && world.coopProject.tiles[0] === s.coop && world.buildings[s.coop]?.kind === 'peteCoop'
}
export function nearCoop(coop: number, tile: number): boolean {
  return Math.max(Math.abs(tile % SIZE - coop % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(coop / SIZE))) <= 3
}
function dry(world: World, tile: number): boolean { return !world.water[tile] && !world.buildings[tile] }
// At most 48 exterior cells; never traverse water, even where a footbridge exists.
export function poultryGround(world: World, coop: number): Map<number, number> {
  const yard = enclosedYard(world), allowed = (i: number) => dry(world, i) && (!yard || yardInterior(yard, i))
  const queue = neighboringTiles(coop).filter(i => allowed(i)), parents = new Map(queue.map(i => [i, -1]))
  for (let h = 0; h < queue.length; h++) for (const i of neighboringTiles(queue[h])) if (nearCoop(coop, i) && allowed(i) && !parents.has(i)) { parents.set(i, queue[h]); queue.push(i) }
  return parents
}
function random(s: Poultry): number {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0
  return s.seed / 4294967296
}
function bird(id: number, now: number): Bird {
  return { id, kind: id < 3 ? 'adult' : 'chick', mode: 'inside', tile: null, next: null, travelMs: 0, untilMs: now + 1000 + id * 500, facing: 'east' }
}
export function birdStepMs(b: Bird): number { return b.kind === 'adult' ? 900 : 650 }
export function eggAt(world: World, tile: number | null): Egg | null {
  return tile === null || !poultryActive(world) || !dry(world, tile) ? null : world.poultry!.eggs.find(e => e.tile === tile) ?? null
}
function cancelCollection(world: World): void {
  if (!['eggward', 'collectingEgg'].includes(world.peace.activity)) return
  const p = world.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE), path: [], pathRevision: -1 })
  Object.assign(world.peace, { activity: 'homeward', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
}
export function refreshPoultry(world: World): void {
  const s = world.poultry
  if (!s) return
  const active = poultryActive(world), ground = active ? poultryGround(world, s.coop) : new Map<number, number>()
  for (const b of s.birds) {
    if (b.tile !== null && !ground.has(b.tile)) Object.assign(b, { mode: 'inside', tile: null, next: null, travelMs: 0, untilMs: world.timeMs + 2000 })
    else if (b.next !== null && !ground.has(b.next)) Object.assign(b, { mode: 'pecking', next: null, travelMs: 0, untilMs: world.timeMs + 1500 })
  }
  if (!active) s.eggs = []
  if (['eggward', 'collectingEgg'].includes(world.peace.activity) && !eggAt(world, world.peace.destination)) cancelCollection(world)
}
export function reachableEgg(world: World): number | null {
  const s = world.poultry
  if (!s || !poultryActive(world) || s.collected === Number.MAX_SAFE_INTEGER || !s.eggs.length) return null
  const parents = reachableTiles(world, world.pete.tile)
  return s.eggs.filter(e => eggAt(world, e.tile) && parents.has(e.tile)).sort((a, b) => (tilePath(parents, a.tile)?.length ?? Infinity) - (tilePath(parents, b.tile)?.length ?? Infinity) || a.id - b.id)[0]?.tile ?? null
}
export function collectEgg(world: World): boolean {
  const s = world.poultry, egg = eggAt(world, world.peace.destination)
  if (!s || !egg || world.peace.home === null || world.peace.activity !== 'collectingEgg' || world.timeMs < world.peace.untilMs || world.pete.next !== null || world.pete.tile !== egg.tile || s.collected === Number.MAX_SAFE_INTEGER) return false
  s.eggs = s.eggs.filter(e => e.id !== egg.id); s.collected++
  awardActivity(world.personality, EGG_REWARD)
  return true
}
function followStep(s: Poultry, b: Bird, ground: Map<number, number>): number | null {
  const adults = s.birds.filter(a => a.kind === 'adult' && a.tile !== null)
  if (!adults.length) return null
  const parents = new Map<number, number>([[b.tile!, -1]]), queue = [b.tile!]
  for (let h = 0; h < queue.length; h++) for (const i of neighboringTiles(queue[h])) if (ground.has(i) && !parents.has(i)) { parents.set(i, queue[h]); queue.push(i) }
  const paths = adults.map(a => tilePath(parents, a.tile!)).filter((p): p is number[] => p !== null && p.length > 0).sort((a, b) => a.length - b.length || a[a.length - 1] - b[b.length - 1])
  return paths[0]?.[0] ?? null
}
export function advancePoultry(world: World, delta: number): void {
  if (!world.poultry && world.coopProject?.phase === 'complete') {
    const coop = world.coopProject.tiles[0]
    if (world.buildings[coop]?.kind === 'peteCoop') world.poultry = { coop, populatedAtMs: world.timeMs, chicksAtMs: world.timeMs + CHICK_DELAY_MS, chicksSpawned: false, birds: [0, 1, 2].map(id => bird(id, world.timeMs)), eggs: [], nextEggAtMs: world.timeMs + 45000, nextEggId: 1, collected: 0, eaten: 0, seed: (coop ^ 0x63686963) >>> 0 }
  }
  const s = world.poultry
  if (!s) return
  refreshPoultry(world)
  if (!poultryActive(world)) return
  if (!s.chicksSpawned && world.timeMs >= s.chicksAtMs) { s.chicksSpawned = true; s.birds.push(bird(3, world.timeMs), bird(4, world.timeMs)) }
  const bedtime = poultryBedtime(world)
  const ground = poultryGround(world, s.coop), exits = neighboringTiles(s.coop).filter(i => ground.has(i))
  for (const b of s.birds) {
    if (b.mode === 'walking') {
      b.travelMs += delta
      if (b.travelMs >= birdStepMs(b)) Object.assign(b, { tile: b.next, next: null, travelMs: 0, mode: 'pecking', untilMs: world.timeMs + 1000 + Math.floor(random(s) * 61) * 50 })
      continue
    }
    if (bedtime) {
      if (b.tile === null || exits.includes(b.tile)) { Object.assign(b, { mode: 'inside', tile: null, next: null, travelMs: 0, untilMs: world.timeMs + 1000 }); continue }
      b.next = ground.get(b.tile) ?? null
      if (b.next !== null) {
        if (b.next % SIZE !== b.tile % SIZE) b.facing = b.next % SIZE > b.tile % SIZE ? 'east' : 'west'
        Object.assign(b, { mode: 'walking', travelMs: 0, untilMs: 0 })
      } else b.untilMs = world.timeMs + 1000
      continue
    }
    if (world.timeMs < b.untilMs) continue
    if (b.tile === null) {
      if (!exits.length) { b.untilMs = world.timeMs + 2000; continue }
      b.tile = exits[Math.floor(random(s) * exits.length)]; b.mode = 'pecking'; b.untilMs = world.timeMs + 1000 + b.id * 150
      continue
    }
    if (random(s) < .22) {
      if (exits.includes(b.tile)) { Object.assign(b, { mode: 'inside', tile: null, next: null, travelMs: 0, untilMs: world.timeMs + 3000 + Math.floor(random(s) * 81) * 50 }); continue }
      b.next = ground.get(b.tile) ?? null
    } else if (b.kind === 'chick' && random(s) < .65) b.next = followStep(s, b, ground)
    else {
      const options = neighboringTiles(b.tile).filter(i => ground.has(i))
      b.next = options[Math.floor(random(s) * options.length)] ?? null
    }
    if (b.next === null) { b.untilMs = world.timeMs + 1500; continue }
    if (b.next % SIZE !== b.tile % SIZE) b.facing = b.next % SIZE > b.tile % SIZE ? 'east' : 'west'
    b.mode = 'walking'; b.travelMs = 0; b.untilMs = 0
  }
  if (world.timeMs >= s.nextEggAtMs) {
    const layers = s.birds.filter(b => !bedtime && b.kind === 'adult' && b.mode === 'pecking' && b.tile !== null && !s.eggs.some(e => e.tile === b.tile))
    if (s.eggs.length < MAX_EGGS && layers.length && s.nextEggId < Number.MAX_SAFE_INTEGER) {
      const layer = layers[Math.floor(random(s) * layers.length)]
      s.eggs.push({ id: s.nextEggId++, tile: layer.tile!, laidAtMs: world.timeMs, laidBy: layer.id })
    }
    s.nextEggAtMs = world.timeMs + 45000 + Math.floor(random(s) * 401) * 50
  }
}
