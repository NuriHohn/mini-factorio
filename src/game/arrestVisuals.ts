import { ARREST_MS } from '../simulation/police'
import type { Position, World } from '../simulation/world'
export const RESTRAINT_EFFECT_MS = 900
// The completed-arrest counter changes at pickup completion, not at its start.
export function arrestStage(world: World): 1 | 2 | 3 {
  const upcoming = world.revenge.arrests + (world.police.car?.phase === 'ARRESTING' ? 1 : 0)
  return upcoming <= 1 ? 1 : upcoming === 2 ? 2 : 3
}
export function arrestVisual(world: World) {
  const car = world.police.car
  if (!car || car.phase === 'RESPONDING') return null
  const stage = arrestStage(world)
  const elapsed = car.arrestStartedAtMs === undefined ? car.phase === 'ARRESTING' ? car.arrestElapsedMs : RESTRAINT_EFFECT_MS : world.timeMs - car.arrestStartedAtMs
  const active = stage > 1 && elapsed >= 0 && elapsed < RESTRAINT_EFFECT_MS
  const rope = active && stage === 3 && elapsed >= 350
  const holdMs = stage === 2 ? 450 : 600
  const t = stage === 1 ? car.arrestElapsedMs / ARREST_MS : Math.max(0, Math.min(1, (car.arrestElapsedMs - holdMs) / (ARREST_MS - holdMs)))
  const pete: Position = car.phase === 'ARRESTING' ? { x: car.arrestFrom.x + (car.x - car.arrestFrom.x) * t, y: car.arrestFrom.y + (car.y - car.arrestFrom.y) * t } : { x: car.x, y: car.y }
  return { stage, active, rope, pete, wobble: rope && elapsed >= 600 ? Math.sin((elapsed - 600) / 30) * 3 : 0, caption: active ? rope ? 'CLICK! ZURR!' : 'CLICK!' : null }
}
