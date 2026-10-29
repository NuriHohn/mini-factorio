import type { Position, World } from './world'

export const WALKER_TILE_MS = 750
export const TARGET_INACTIVE_MS = 5000
export const EMP_RECOVERY_MS = 2000
export const WARNING_MS = 5000
export const STOMP_MS = 1500
export const BREAKDOWN_MS = 2000
export const STUN_MS = 5000
export const COMBAT_TOOLS = {
  flySwatter: { damage: 5, cooldownMs: 1000, technology: null },
  drill: { damage: 15, cooldownMs: 1500, technology: 'revengeDefense1' },
  lightningBeam: { damage: 30, cooldownMs: 2000, technology: 'revengeDefense2' },
} as const
export type CombatTool = keyof typeof COMBAT_TOOLS
export interface Walker extends Position {
  tile: number; next: number | null; travelMs: number
  hp: number; phase: 1 | 2; stomped: boolean
  targetInactiveMs?: number
  target: number | null; lastTarget: number | null; empAtMs: number
}
export type RevengeStage = 'idle' | 'warning' | 'hunting' | 'stomp' | 'defeating' | 'stunned'
export interface RevengeState {
  arrests: number; threshold: number; stage: RevengeStage; untilMs: number
  boss: Walker | null
  playerCooldownMs: number; playerReadyAtMs: number; policeReadyAtMs: number; sprinklerReadyAtMs: number
  blast: { kind: 'emp' | 'stomp'; position: Position; atMs: number } | null
}
export function createRevenge(): RevengeState {
  return { arrests: 0, threshold: 3, stage: 'idle', untilMs: 0, boss: null, playerCooldownMs: 0, playerReadyAtMs: 0, policeReadyAtMs: 0, sprinklerReadyAtMs: 0, blast: null }
}
export function bossAlive(world: World): boolean { return world.revenge.stage === 'hunting' || world.revenge.stage === 'stomp' }
export function peteUnavailable(world: World): boolean { return !['idle', 'warning'].includes(world.revenge.stage) }
export function walkerOccupiesTile(world: World, tile: number): boolean {
  return world.revenge.boss?.tile === tile || world.revenge.boss?.next === tile
}
export function combatTool(tool: string | null): tool is CombatTool { return tool !== null && Object.hasOwn(COMBAT_TOOLS, tool) }
export function combatPosition(screen: Position, camera: { scrollX: number; scrollY: number; zoom: number; width: number; height: number; getWorldPoint?: (x: number, y: number) => Position }, tile = 32): Position {
  if (camera.getWorldPoint) {
    const point = camera.getWorldPoint(screen.x, screen.y)
    return { x: point.x / tile - .5, y: point.y / tile - .5 }
  }
  return { x: (camera.scrollX + camera.width / 2 + (screen.x - camera.width / 2) / camera.zoom) / tile - .5, y: (camera.scrollY + camera.height / 2 + (screen.y - camera.height / 2) / camera.zoom) / tile - .5 }
}
