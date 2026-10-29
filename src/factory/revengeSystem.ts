import { steamShare } from '../simulation/steamWork'
import { generationKw, ratedGeneration } from '../simulation/power'
import { peaceful } from '../simulation/peace'
import { reachableTiles, tilePath, edgeTile, neighboringTiles } from '../simulation/navigation'
import { isSabotageable } from '../simulation/buildingCapabilities'
import { hasTechnology } from '../simulation/research'
import { SIZE } from '../simulation/world'
import type { Position, World } from '../simulation/world'
import { RECIPES } from '../simulation/recipes'

import { WALKER_TILE_MS, TARGET_INACTIVE_MS, EMP_RECOVERY_MS, WARNING_MS, STOMP_MS, BREAKDOWN_MS, STUN_MS, COMBAT_TOOLS, bossAlive } from '../simulation/revenge'
import type { Walker, CombatTool } from '../simulation/revenge'

export function recordArrest(world: World): void {
  if (peaceful(world)) return
  const r = world.revenge
  if (r.stage !== 'idle') return
  r.arrests++
  if (r.arrests >= r.threshold) { r.stage = 'warning'; r.untilMs = world.timeMs + WARNING_MS }
}
function freeTile(world: World, tile: number): boolean {
  const car = world.police.car
  return !world.water[tile] && !world.buildings[tile] && car?.tile !== tile && car?.next !== tile && !world.buildings.some(b => b?.kind === 'prison' && b.exit === tile)
}
function resetPete(world: World, tile: number): void {
  Object.assign(world.pete, { x: tile % SIZE, y: Math.floor(tile / SIZE), tile, next: null, travelMs: 0, mode: 'WANDERING', prison: null, imprisonedAtMs: null, pumpkin: null, webMs: 0, water: null, trappedBy: null, ignoredWebs: [], jailbreak: null, graceUntilMs: world.timeMs, path: [], pathRevision: -1, escape: null, cryingMs: 0 })
  world.police.car = null
}
function spawn(world: World): void {
  // Tile order is stable; a full/obstructed edge leaves the warning pending.
  let tile = world.buildings.findIndex((_, i) => edgeTile(i) && freeTile(world, i) && world.pete.tile !== i && world.pete.next !== i)
  if (tile < 0) return
  // Visit each edge component once, preferring an approachable productive target.
  const visited = new Set<number>()
  let generatorEdge: number | null = null
  const hasTargets = world.buildings.some((_, index) => productiveTarget(world, index))
  for (let i = tile; hasTargets && i < world.buildings.length; i++) {
    if (!edgeTile(i) || visited.has(i) || !freeTile(world, i) || world.pete.tile === i || world.pete.next === i) continue
    const parents = reachableTiles(world, i, false)
    for (const reachable of parents.keys()) visited.add(reachable)
    const target = chooseTarget(world, { tile: i, x: i % SIZE, y: Math.floor(i / SIZE), lastTarget: null }, parents)
    if (target === null) continue
    if (ratedGeneration(world.buildings[target]!) === 0) { generatorEdge = i; break }
    generatorEdge ??= i
  }
  tile = generatorEdge ?? tile
  resetPete(world, tile)
  world.revenge.boss = { x: tile % SIZE, y: Math.floor(tile / SIZE), tile, next: null, travelMs: 0, hp: 100, phase: 1, stomped: false, target: null, targetInactiveMs: 0, lastTarget: null, empAtMs: world.timeMs + 4000 }
  world.revenge.stage = 'hunting'; world.revenge.untilMs = 0
}
export function damageWalker(world: World, damage: number): boolean {
  const r = world.revenge, boss = r.boss
  if (peaceful(world) || !boss || !bossAlive(world) || !Number.isSafeInteger(damage) || damage <= 0) return false
  const previous = boss.hp
  boss.hp = Math.max(0, boss.hp - damage)
  if (boss.hp === 0) {
    r.stage = 'defeating'; r.untilMs = world.timeMs + BREAKDOWN_MS
    r.arrests = 0; r.threshold += 2
    world.police.car = null
  } else if (previous > 50 && boss.hp <= 50 && !boss.stomped) {
    boss.phase = 2; boss.stomped = true
    r.stage = 'stomp'; r.untilMs = world.timeMs + STOMP_MS
  }
  return true
}
function pursuitTarget(world: World, index: number): boolean {
  const kind = world.buildings[index]?.kind
  return kind === 'miner' || kind === 'furnace' || kind === 'assembler' || kind === 'generator' || kind === 'waterwheel' || kind === 'steamEngine' || kind === 'steamWorkshop' || kind === 'steamHoist'
}
export function productiveTarget(world: World, index: number): boolean {
  const b = world.buildings[index]
  if (!b) return false
  if (ratedGeneration(b) > 0) return generationKw(world, b) > 0
  const speed = world.power?.consumers[index]?.speedFraction ?? 0
  if (speed <= 0) return false
  if (b.kind === 'steamWorkshop' || b.kind === 'steamHoist') return steamShare(world, b) > 0
  if (b.kind === 'miner') return !b.item && !!world.tiles[index]
  return (b.kind === 'furnace' || b.kind === 'assembler') && !!b.job && b.job.elapsedMs < RECIPES[b.job.recipeId].durationMs
}
// Keep the existing disable duration, but guarantee a recovery window across the
// whole splash area before another EMP can extend any of those outages.
export function empTargetEligible(world: World, index: number): boolean {
  const target = world.buildings[index]
  return productiveTarget(world, index) && !!target && world.buildings.every(b => !b || !isSabotageable(b) || Math.hypot(b.x - target.x, b.y - target.y) > 3 || !b.sabotageUntilMs || world.timeMs >= b.sabotageUntilMs + EMP_RECOVERY_MS)
}
function chooseTarget(world: World, boss: Pick<Walker, 'tile' | 'x' | 'y' | 'lastTarget'>, parents?: Map<number, number>): number | null {
  const priority = { steamWorkshop: 0, steamHoist: 0, assembler: 0, furnace: 1, miner: 2, generator: 3, waterwheel: 3, steamEngine: 3 }
  const candidates = world.buildings.flatMap((b, i) => b && productiveTarget(world, i) && (b.kind === 'assembler' || b.kind === 'furnace' || b.kind === 'miner' || b.kind === 'generator' || b.kind === 'waterwheel' || b.kind === 'steamEngine' || b.kind === 'steamWorkshop' || b.kind === 'steamHoist') ? [{ index: i, rank: priority[b.kind], distance: (b.x - boss.x) ** 2 + (b.y - boss.y) ** 2 }] : [])
  if (!candidates.length) return null
  const reachable = parents ?? reachableTiles(world, boss.tile, false)
  const canApproach = (index: number) => [...reachable.keys()].some(tile => (tile % SIZE - index % SIZE) ** 2 + (Math.floor(tile / SIZE) - Math.floor(index / SIZE)) ** 2 <= 36)
  return candidates.filter(c => canApproach(c.index)).sort((a, b) => a.rank - b.rank || Number(a.index === boss.lastTarget) - Number(b.index === boss.lastTarget) || a.distance - b.distance || a.index - b.index)[0]?.index ?? null
}
function blast(world: World, position: Position, kind: 'emp' | 'stomp'): void {
  const radius = kind === 'emp' ? 3 : 5, duration = kind === 'emp' ? 6000 : 8000
  for (const b of world.buildings) if (b && isSabotageable(b) && Math.hypot(b.x - position.x, b.y - position.y) <= radius) b.sabotageUntilMs = Math.max(b.sabotageUntilMs ?? 0, world.timeMs + duration)
  world.revenge.blast = { kind, position: { x: position.x, y: position.y }, atMs: world.timeMs }
}
export function advanceRevenge(world: World, delta: number): void {
  if (peaceful(world)) return
  const r = world.revenge, boss = r.boss
  if (r.blast && world.timeMs - r.blast.atMs >= 1000) r.blast = null
  if (r.stage === 'warning') { if (world.timeMs >= r.untilMs) spawn(world); return }
  if (r.stage === 'stunned') {
    if (world.timeMs >= r.untilMs) { r.stage = 'idle'; r.untilMs = 0 }
    return
  }
  if (!boss) return
  if (r.stage === 'defeating') {
    if (world.timeMs < r.untilMs) return
    const tiles = world.buildings.flatMap((_, i) => freeTile(world, i) ? [i] : [])
    tiles.sort((a, b) => (a % SIZE - boss.x) ** 2 + (Math.floor(a / SIZE) - boss.y) ** 2 - ((b % SIZE - boss.x) ** 2 + (Math.floor(b / SIZE) - boss.y) ** 2) || a - b)
    if (!tiles.length) return
    resetPete(world, tiles[0]); r.boss = null
    r.stage = 'stunned'; r.untilMs = world.timeMs + STUN_MS
    return
  }
  if (r.stage === 'stomp') {
    if (world.timeMs >= r.untilMs) { blast(world, boss, 'stomp'); r.stage = 'hunting'; r.untilMs = 0; boss.empAtMs = world.timeMs + 3000 }
    return
  }
  boss.targetInactiveMs = boss.target !== null && !productiveTarget(world, boss.target) ? Math.min(TARGET_INACTIVE_MS, (boss.targetInactiveMs ?? 0) + delta) : 0
  if (boss.target === null || !pursuitTarget(world, boss.target) || boss.targetInactiveMs >= TARGET_INACTIVE_MS) {
    boss.target = chooseTarget(world, boss)
    boss.targetInactiveMs = 0
  }
  let target = boss.target === null ? null : world.buildings[boss.target]
  let parents: Map<number, number> | undefined
  if (boss.next === null && target && Math.hypot(target.x - boss.x, target.y - boss.y) > 6) {
    parents = reachableTiles(world, boss.tile, false)
    if (![...parents.keys()].some(tile => Math.hypot(tile % SIZE - target!.x, Math.floor(tile / SIZE) - target!.y) <= 6)) {
      boss.target = chooseTarget(world, boss, parents)
      boss.targetInactiveMs = 0
      target = boss.target === null ? null : world.buildings[boss.target]
    }
  }
  // Complete the current tile traversal before aiming or choosing a fresh path.
  if (boss.next === null && target && Math.hypot(target.x - boss.x, target.y - boss.y) <= 6) {
    if (world.timeMs >= boss.empAtMs && empTargetEligible(world, boss.target!)) {
      blast(world, target, 'emp'); boss.lastTarget = boss.target; boss.target = null; boss.targetInactiveMs = 0
      boss.empAtMs = world.timeMs + (boss.phase === 1 ? 4000 : 3000)
    }
    return
  }
  if (boss.next === null && target) {
    parents ??= reachableTiles(world, boss.tile, false)
    const approach = [...parents.keys()].filter(tile => Math.hypot(tile % SIZE - target.x, Math.floor(tile / SIZE) - target.y) <= 6).sort((a, b) => (Math.abs(a % SIZE - boss.tile % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(boss.tile / SIZE))) - (Math.abs(b % SIZE - boss.tile % SIZE) + Math.abs(Math.floor(b / SIZE) - Math.floor(boss.tile / SIZE))) || a - b)[0]
    boss.next = approach === undefined ? null : tilePath(parents, approach)?.[0] ?? null
  }
  if (boss.next === null && !target) {
    // Like Pete's normal walk, choose a free cardinal neighbor. The fixed tick
    // and tile supply a deterministic hash, so no extra RNG/save state is needed.
    const choices = neighboringTiles(boss.tile).filter(tile => !world.water[tile] && !world.buildings[tile])
    let hash = Math.imul(boss.tile + world.timeMs / 50, 0x45d9f3b)
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
    const choice = (hash ^ (hash >>> 16)) >>> 0
    boss.next = choices[choice % choices.length] ?? null
  }
  if (boss.next === null) return
  if (world.water[boss.next] || world.buildings[boss.next]) { boss.next = null; boss.travelMs = 0; boss.x = boss.tile % SIZE; boss.y = Math.floor(boss.tile / SIZE); boss.target = null; boss.targetInactiveMs = 0; return }
  boss.travelMs = Math.min(WALKER_TILE_MS, boss.travelMs + delta)
  const t = boss.travelMs / WALKER_TILE_MS
  boss.x = boss.tile % SIZE + (boss.next % SIZE - boss.tile % SIZE) * t
  boss.y = Math.floor(boss.tile / SIZE) + (Math.floor(boss.next / SIZE) - Math.floor(boss.tile / SIZE)) * t
  if (boss.travelMs === WALKER_TILE_MS) { boss.tile = boss.next; boss.next = null; boss.travelMs = 0 }
}
export function combatError(world: World, tool: CombatTool): string | null {
  if (peaceful(world)) return 'Pete is peaceful. Enjoy your new neighbor!'
  const technology = COMBAT_TOOLS[tool].technology
  return technology && !hasTechnology(world.research, technology) ? 'Research the required Revenge Defense technology.' : null
}
// Positions use actor tile centers, the same coordinate convention as Pete hit tests.
export function walkerHit(world: World, position: Position): boolean {
  const boss = world.revenge.boss
  return !!boss && bossAlive(world) && Math.abs(position.x - boss.x) <= 1.25 && Math.abs(position.y - boss.y) <= 1.1
}
export interface CombatImpact { tool: CombatTool; position: Position; hit: boolean; atMs: number; damage: number }
export function attackWalker(world: World, tool: CombatTool, position: Position): CombatImpact | null {
  const r = world.revenge
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || combatError(world, tool) || world.timeMs < r.playerReadyAtMs) return null
  const hit = walkerHit(world, position), definition = COMBAT_TOOLS[tool]
  r.playerCooldownMs = definition.cooldownMs
  r.playerReadyAtMs = world.timeMs + definition.cooldownMs
  if (hit) damageWalker(world, definition.damage)
  return { tool, position: { x: position.x, y: position.y }, hit, atMs: world.timeMs, damage: hit ? definition.damage : 0 }
}
// Shared camera transform for canvas input and hit-test regressions.
