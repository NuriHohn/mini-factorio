import { facesWater as waterwheelWater } from './waterTerrain'
export { facesWater as waterwheelWater } from './waterTerrain'
import type { Waterwheel, World } from './world'
export const WATERWHEEL_WOOD = 10
export const WATERWHEEL_KW = 50
export const WATERWHEEL_PERIOD_MS = 8000
export function advanceWaterwheels(world: World, delta: number): void {
  for (const b of world.buildings) if (b?.kind === 'waterwheel' && waterwheelRunning(world, b)) b.rotationMs = (b.rotationMs + delta) % WATERWHEEL_PERIOD_MS
}
export function waterwheelRunning(world: World, b: Waterwheel): boolean {
  return (b.sabotageUntilMs ?? 0) <= world.timeMs && waterwheelWater(world, b, b.direction)
}
