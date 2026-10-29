import { SIZE } from './world'
import type { Position, World } from './world'
export const WEB_FLIGHT_MS = 300
export const WEB_LIFETIME_MS = 10000
export const MAX_GROUND_WEBS = 128
export interface GroundWeb { id: number; tile: number; from: Position; launchedAtMs: number; landsAtMs: number; expiresAtMs: number }
export interface WebState { nextId: number; patches: GroundWeb[] }
export function createWebs(): WebState { return { nextId: 1, patches: [] } }
export function peteWebTile(world: World): number { return Math.floor(world.pete.y + .5) * SIZE + Math.floor(world.pete.x + .5) }
