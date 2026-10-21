import * as v from './validation'
import { BREAKDOWN_MS, createRevenge, STOMP_MS, STUN_MS, WARNING_MS, WALKER_TILE_MS, TARGET_INACTIVE_MS } from '../simulation/revenge'
import type { RevengeState, Walker } from '../simulation/revenge'
import { neighboringTiles } from '../simulation/navigation'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
export { createRevenge }
export function restoreRevenge(value: unknown, world: World): RevengeState {
  const r = v.object(value, 'game.revenge', ['arrests', 'threshold', 'stage', 'untilMs', 'boss', 'playerCooldownMs', 'playerReadyAtMs', 'policeReadyAtMs', 'sprinklerReadyAtMs', 'blast'])
  const threshold = v.number(r.threshold, 'revenge.threshold', 3, Number.MAX_SAFE_INTEGER - 2, true)
  if (threshold % 2 !== 1) v.invalid('revenge.threshold', 'expected escalation 3, 5, 7, ...')
  const stage = v.choice(r.stage, 'revenge.stage', ['idle', 'warning', 'hunting', 'stomp', 'defeating', 'stunned'] as const)
  const arrests = v.count(r.arrests, 'revenge.arrests', threshold)
  const untilMs = v.count(r.untilMs, 'revenge.untilMs', world.timeMs + Math.max(WARNING_MS, STUN_MS))
  if ((stage === 'idle' && (arrests >= threshold || untilMs !== 0)) || (['warning', 'hunting', 'stomp'].includes(stage) && arrests !== threshold) || (['defeating', 'stunned'].includes(stage) && (arrests !== 0 || threshold < 5))) v.invalid('revenge', 'inconsistent event progress')
  const timerLimit = stage === 'warning' ? WARNING_MS : stage === 'stomp' ? STOMP_MS : stage === 'defeating' ? BREAKDOWN_MS : stage === 'stunned' ? STUN_MS : 0
  if ((!timerLimit && untilMs !== 0) || untilMs > world.timeMs + timerLimit || (['stomp', 'stunned'].includes(stage) && untilMs <= world.timeMs)) v.invalid('revenge.untilMs', 'inconsistent event timer')
  let boss: Walker | null = null
  if (r.boss !== null) {
    const b = v.object(r.boss, 'revenge.boss', ['x', 'y', 'tile', 'next', 'travelMs', 'hp', 'phase', 'stomped', 'target', 'lastTarget', 'empAtMs'], ['targetInactiveMs'])
    const tile = v.tile(b.tile, 'boss.tile'), next = b.next === null ? null : v.tile(b.next, 'boss.next')
    const legacy = !Object.hasOwn(b, 'targetInactiveMs'), duration = legacy ? 1500 : WALKER_TILE_MS
    const savedTravelMs = v.count(b.travelMs, 'boss.travelMs', duration - 1)
    if (savedTravelMs % (legacy ? 50 : 25) !== 0) v.invalid('boss.travelMs', 'expected fixed-step movement')
    const travelMs = savedTravelMs * WALKER_TILE_MS / duration
    const hp = v.count(b.hp, 'boss.hp', 100), phase = v.number(b.phase, 'boss.phase', 1, 2, true) as 1 | 2
    const stomped = v.boolean(b.stomped, 'boss.stomped'), position = v.position({ x: b.x, y: b.y }, 'boss.position')
    if (world.buildings[tile] || (next !== null && (world.buildings[next] || !neighboringTiles(tile).includes(next))) || (next === null && travelMs !== 0)) v.invalid('boss', 'invalid movement or occupancy')
    const t = travelMs / WALKER_TILE_MS
    if (Math.abs(position.x - (tile % SIZE + ((next ?? tile) % SIZE - tile % SIZE) * t)) > 1e-7 || Math.abs(position.y - (Math.floor(tile / SIZE) + (Math.floor((next ?? tile) / SIZE) - Math.floor(tile / SIZE)) * t)) > 1e-7) v.invalid('boss', 'position disagrees with movement')
    if ((stage === 'defeating') !== (hp === 0) || (phase === 1 && (stomped || (hp > 0 && hp <= 50))) || (phase === 2 && (!stomped || hp > 50)) || (stage === 'stomp' && phase !== 2)) v.invalid('boss', 'inconsistent phase, health or stomp')
    const targetInactiveMs = legacy ? 0 : v.count(b.targetInactiveMs, 'boss.targetInactiveMs', TARGET_INACTIVE_MS)
    if (targetInactiveMs % 50 !== 0 || (b.target === null && targetInactiveMs !== 0)) v.invalid('boss.targetInactiveMs', 'inconsistent target timer')
    boss = { ...position, tile, next, travelMs, hp, phase, stomped, targetInactiveMs, target: b.target === null ? null : v.tile(b.target, 'boss.target'), lastTarget: b.lastTarget === null ? null : v.tile(b.lastTarget, 'boss.lastTarget'), empAtMs: v.count(b.empAtMs, 'boss.empAtMs', world.timeMs + 8000) }
  }
  if (['hunting', 'stomp', 'defeating'].includes(stage) !== (boss !== null)) v.invalid('revenge.boss', 'boss and event state disagree')
  if (!['idle', 'warning'].includes(stage) && (world.pete.mode !== 'WANDERING' || world.pete.next !== null || world.pete.travelMs !== 0 || world.pete.path.length !== 0 || world.pete.webMs !== 0 || world.pete.escape !== null || world.pete.pumpkin || world.pete.water || world.pete.trappedBy !== null || (world.police.car && (!['hunting', 'stomp'].includes(stage) || world.police.car.phase !== 'RESPONDING')))) v.invalid('revenge', 'Pete cannot act independently during this event')
  const playerCooldownMs = v.count(r.playerCooldownMs, 'revenge.playerCooldownMs', 2000)
  if (![0, 1000, 1500, 2000].includes(playerCooldownMs)) v.invalid('revenge.playerCooldownMs', 'unknown combat cooldown')
  const playerReadyAtMs = v.count(r.playerReadyAtMs, 'revenge.playerReadyAtMs', world.timeMs + playerCooldownMs)
  if (playerCooldownMs === 0 && playerReadyAtMs !== 0) v.invalid('revenge.playerReadyAtMs', 'cooldown has no attack duration')
  let blast: RevengeState['blast'] = null
  if (r.blast !== null) {
    if (['idle', 'warning', 'stunned'].includes(stage)) v.invalid('revenge.blast', 'blast without an active encounter')
    const b = v.object(r.blast, 'revenge.blast', ['kind', 'position', 'atMs'])
    const atMs = v.count(b.atMs, 'blast.atMs', world.timeMs)
    if (world.timeMs - atMs >= 1000) v.invalid('blast.atMs', 'expired blast')
    blast = { kind: v.choice(b.kind, 'blast.kind', ['emp', 'stomp'] as const), position: v.position(b.position, 'blast.position'), atMs }
  }
  if ([untilMs, playerReadyAtMs, r.policeReadyAtMs, r.sprinklerReadyAtMs, boss?.empAtMs ?? 0, blast?.atMs ?? 0].some(time => typeof time !== 'number' || time % 50 !== 0) || !travelBoundary(boss)) v.invalid('revenge', 'expected fixed-step timer boundaries')
  return { arrests, threshold, stage, untilMs, boss, playerCooldownMs, playerReadyAtMs, policeReadyAtMs: v.count(r.policeReadyAtMs, 'revenge.policeReadyAtMs', world.timeMs + 2000), sprinklerReadyAtMs: v.count(r.sprinklerReadyAtMs, 'revenge.sprinklerReadyAtMs', world.timeMs + 2000), blast }
}
function travelBoundary(boss: Walker | null): boolean { return !boss || boss.travelMs % 25 === 0 }
