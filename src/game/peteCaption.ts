import { arrestVisual } from './arrestVisuals'
import type { World } from '../simulation/world'
// Keep restraints' short comic sound; other reactions already have expressive art.
export function peteCaption(world: World): string {
  const arrest = arrestVisual(world)
  if (arrest?.phase === 'restraints' && arrest.stage > 1) return arrest.rope ? 'CLICK! ZURR!' : 'CLICK!'
  const peace = world.peace
  if (peace.shutdown) return '♥'
  if (peace.home !== null) return peace.activity === 'resting' ? 'Zzz' : peace.activity === 'waving' || peace.activity === 'flowers' ? '♥' : ''
  if (peace.reactionAtMs !== null) return '?'
  const p = world.pete
  if (p.mode === 'COMPLAINING' || p.mode === 'TRAPPED') return '!'
  if (p.mode === 'CRYING') return '…'
  return ''
}
