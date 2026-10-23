import { neighboringTiles } from '../simulation/navigation'
import { hasVeranda, VERANDA_BUILD_MS } from '../simulation/veranda'
import type { SecretProject } from '../simulation/secretProject'
import type { World } from '../simulation/world'
import { restoreProjectSelection } from './projectValidation'
import * as v from './validation'
export function restoreVeranda(value: unknown, world: World, version = 29): SecretProject {
  const r = v.object(value, 'game.verandaProject', ['kind', 'home', 'tiles', 'spots', 'direction', 'phase', 'built', 'carried', 'carriedIron', 'elapsedMs', 'crate'], ['selected', ...(version >= 29 ? ['legacyMaterials'] : [])])
  if (r.kind !== 'veranda' || r.direction !== 'east') v.invalid('verandaProject', 'invalid upgrade kind or direction')
  const home = v.tile(r.home, 'verandaProject.home')
  const tiles = v.array(r.tiles, 'verandaProject.tiles', 1).map(i => v.tile(i, 'verandaProject.tiles'))
  const spots = v.array(r.spots, 'verandaProject.spots', 1).map(i => v.tile(i, 'verandaProject.spots'))
  if (tiles[0] !== home || !neighboringTiles(home).includes(spots[0])) v.invalid('verandaProject', 'upgrade must be attached to its home')
  const phase = v.choice(r.phase, 'verandaProject.phase', ['collecting', 'building', 'complete'] as const)
  const legacy = version < 29 || r.legacyMaterials === true
  if (r.legacyMaterials !== undefined && (r.legacyMaterials !== true || phase !== 'building')) v.invalid('verandaProject.legacyMaterials', 'only paid legacy work may retain old materials')
  const wood = legacy ? 8 : 0, iron = legacy ? 12 : 20
  const built = v.count(r.built, 'verandaProject.built', 1), carried = v.count(r.carried, 'verandaProject.carried', wood), carriedIron = v.count(r.carriedIron, 'verandaProject.carriedIron', iron)
  const elapsedMs = v.count(r.elapsedMs, 'verandaProject.elapsedMs', VERANDA_BUILD_MS - 50), crate = r.crate === null ? null : v.tile(r.crate, 'verandaProject.crate')
  if (elapsedMs % 50 || built !== (phase === 'complete' ? 1 : 0) || carried !== (phase === 'building' ? wood : 0) || carriedIron !== (phase === 'building' ? iron : 0) || (phase !== 'building' && elapsedMs !== 0) || (phase !== 'collecting' && crate !== null) || (crate !== null && world.buildings[crate]?.kind !== 'supplyCrate')) v.invalid('verandaProject', 'invalid material accounting or progress')
  return { ...(legacy && phase === 'building' ? { legacyMaterials: true as const } : {}), ...restoreProjectSelection(r), kind: 'veranda', direction: 'east', home, tiles, spots, phase, built, carried, carriedIron, elapsedMs, crate }
}
export function validateVeranda(world: World): void {
  if (world.verandaProject && world.personality.paths.craftsman.level < 2) v.invalid('verandaProject', 'requires Craftsman level 2')
  if (world.peace.activity === 'verandaRest' && !hasVeranda(world)) v.invalid('peace.activity', 'veranda rest requires a completed home upgrade')
}
