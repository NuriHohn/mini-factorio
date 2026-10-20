import { arrestBoardingProgress, arrestDuration } from '../simulation/police'
import type { Position, World } from '../simulation/world'
// The completed-arrest counter changes at pickup completion, not at its start.
export function arrestStage(world: World): 1 | 2 | 3 {
  const upcoming = world.revenge.arrests + (world.police.car?.phase === 'ARRESTING' ? 1 : 0)
  return upcoming <= 1 ? 1 : upcoming === 2 ? 2 : 3
}
export function arrestVisual(world: World) {
  const car = world.police.car
  if (!car || car.phase === 'RESPONDING') return null
  const stage = arrestStage(world), legacy = car.arrestDurationMs === undefined
  const elapsed = car.arrestStartedAtMs === undefined ? car.phase === 'ARRESTING' ? car.arrestElapsedMs : arrestDuration(car) : world.timeMs - car.arrestStartedAtMs
  const phase = car.phase === 'TRANSPORTING' ? 'transport' : legacy ? 'boarding' : elapsed < 500 ? 'arrival' : elapsed < 1200 ? 'reaction' : elapsed < 2800 ? 'restraints' : 'boarding'
  const active = stage > 1 && elapsed >= (legacy ? 0 : 1200) && elapsed < arrestDuration(car)
  const rope = active && stage === 3 && elapsed >= (legacy ? 350 : 2000)
  const alpha = active ? legacy ? 1 : Math.min(1, (elapsed - 1200) / 250, (arrestDuration(car) - elapsed) / 400) : 0
  const t = arrestBoardingProgress(car)
  const pete: Position = car.phase === 'ARRESTING' ? { x: car.arrestFrom.x + (car.x - car.arrestFrom.x) * t, y: car.arrestFrom.y + (car.y - car.arrestFrom.y) * t } : { x: car.x, y: car.y }
  const caption = phase === 'transport' ? null : phase === 'arrival' ? 'Easy does it…' : phase === 'reaction' ? 'Pete · who, me?!' : phase === 'boarding' ? 'All aboard!' : stage === 1 ? 'This way, Pete.' : rope ? 'CLICK! ZURR!' : 'CLICK!'
  return { stage, phase, active, rope, alpha, ropeAlpha: rope ? alpha * Math.min(1, (elapsed - (legacy ? 350 : 2000)) / 300) : 0, pete, boarding: t, passenger: phase === 'transport' || (!legacy && elapsed >= 3300), wobble: rope ? Math.sin((elapsed - 2000) / 220) * alpha : phase === 'arrival' ? Math.sin(elapsed / 500 * Math.PI) : 0, caption }
}
