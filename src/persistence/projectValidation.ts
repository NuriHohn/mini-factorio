import { FENCE_SEGMENT_MS, PROJECT_WOOD } from '../simulation/secretProject'
import type { SecretProject } from '../simulation/secretProject'
import { neighboringTiles } from '../simulation/navigation'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restoreProject(value: unknown, world: World): SecretProject | null {
  if (value === undefined) {
    if (world.peace.activity === 'project' || world.buildings.some(b => b?.kind === 'peteFence')) v.invalid('project', 'missing project state')
    return null
  }
  const r = v.object(value, 'game.project', ['home', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'elapsedMs'])
  const home = v.tile(r.home, 'project.home'), direction = v.choice(r.direction, 'project.direction', ['east', 'south'] as const)
  const tiles = v.array(r.tiles, 'project.tiles', 3).map((n, i) => v.tile(n, `project.tiles[${i}]`))
  const spots = v.array(r.spots, 'project.spots', 3).map((n, i) => v.tile(n, `project.spots[${i}]`))
  const cx = tiles[1] % SIZE, cy = Math.floor(tiles[1] / SIZE), hx = home % SIZE, hy = Math.floor(home / SIZE)
  const dx = Math.sign(cx - hx), dy = Math.sign(cy - hy), step = direction === 'east' ? 1 : SIZE
  if ((direction === 'east' ? cx !== hx || Math.abs(cy - hy) !== 3 : cy !== hy || Math.abs(cx - hx) !== 3) || tiles.some((n, i) => n !== tiles[1] + (i - 1) * step || !neighboringTiles(n).includes(spots[i]) || spots[i] !== n - dy * SIZE - dx) || new Set(tiles).size !== 3 || (direction === 'east' && tiles.some(n => Math.floor(n / SIZE) !== cy))) v.invalid('project.tiles', 'invalid compact fence geometry')
  const phase = v.choice(r.phase, 'project.phase', ['collecting', 'building', 'complete'] as const)
  const built = v.count(r.built, 'project.built', 3), carried = v.count(r.carried, 'project.carried', PROJECT_WOOD)
  const elapsedMs = v.count(r.elapsedMs, 'project.elapsedMs', FENCE_SEGMENT_MS - 50), crate = r.crate === null ? null : v.tile(r.crate, 'project.crate')
  if (elapsedMs % 50 || (phase === 'collecting' ? built !== 0 || carried !== 0 || elapsedMs !== 0 : phase === 'complete' ? built !== 3 || carried !== 0 || elapsedMs !== 0 || crate !== null : built >= 3 || carried !== PROJECT_WOOD - built * PROJECT_WOOD / 3 || crate !== null)) v.invalid('project', 'invalid resource accounting or progress')
  if (crate !== null && world.buildings[crate]?.kind !== 'supplyCrate') v.invalid('project.crate', 'missing supply crate')
  for (let i = 0; i < world.buildings.length; i++) {
    const b = world.buildings[i]
    if (b?.kind === 'peteFence' && (!tiles.slice(0, built).includes(i) || b.direction !== direction)) v.invalid('project', 'fence disagrees with completed work')
  }
  if (world.peace.activity === 'project') {
    const destination = world.peace.destination
    if (phase === 'complete' || world.peace.home === null || (destination !== null && (phase === 'collecting' ? crate === null || !neighboringTiles(crate).includes(destination) : destination !== spots[built]))) v.invalid('project', 'activity and destination disagree')
  }
  return { home, direction, tiles, spots, phase, crate, built, carried, elapsedMs }
}
