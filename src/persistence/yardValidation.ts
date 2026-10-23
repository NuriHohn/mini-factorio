import { restoreProjectSelection } from './projectValidation'
import { YARD_MAX_SPAN, yardBoundary, yardDirection, yardInterior } from '../simulation/yard'
import type { Yard } from '../simulation/yard'
import { neighboringTiles } from '../simulation/navigation'
import type { World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import * as v from './validation'
export function restoreYard(value: unknown, world: World, version = 35, run = false): Yard | null {
  if (value === undefined) return null
  const r = v.object(value, 'game.yard', ['kind', 'left', 'right', 'top', 'bottom', 'home', 'entrance', 'reused', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'elapsedMs'], version >= 22 ? ['selected', ...(version >= 36 ? ['deferredWork'] : [])] : [])
  if (r.kind !== (run ? 'run' : 'yard') || (run && world.gateProject?.phase !== 'complete') || world.project?.phase !== 'complete' || world.coopProject?.phase !== 'complete' || world.campfireProject?.phase !== 'complete') v.invalid('yard', 'yard requires completed preceding projects')
  const left = v.number(r.left, 'yard.left', 1, SIZE - 2, true), right = v.number(r.right, 'yard.right', left + 2, Math.min(left + (version >= 32 ? YARD_MAX_SPAN : 10), SIZE - 2), true)
  const top = v.number(r.top, 'yard.top', 1, SIZE - 2, true), bottom = v.number(r.bottom, 'yard.bottom', top + 2, Math.min(top + (version >= 32 ? YARD_MAX_SPAN : 10), SIZE - 2), true)
  const home = v.tile(r.home, 'yard.home'), entrance = v.tile(r.entrance, 'yard.entrance'), direction = v.choice(r.direction, 'yard.direction', ['east'] as const)
  const tiles = v.array(r.tiles, 'yard.tiles', undefined, version >= 32 ? 55 : 39).map((i, n) => v.tile(i, `yard.tiles[${n}]`)), spots = v.array(r.spots, 'yard.spots', tiles.length).map((i, n) => v.tile(i, `yard.spots[${n}]`))
  const reused = v.array(r.reused, 'yard.reused', undefined, run ? 55 : 3).map((i, n) => v.tile(i, `yard.reused[${n}]`))
  const phase = v.choice(r.phase, 'yard.phase', ['collecting', 'building', 'complete'] as const), built = v.count(r.built, 'yard.built', tiles.length), carried = v.count(r.carried, 'yard.carried', 2), elapsedMs = v.count(r.elapsedMs, 'yard.elapsedMs', 3950), crate = r.crate === null ? null : v.tile(r.crate, 'yard.crate')
  const yard: Yard = { ...restoreProjectSelection(r), kind: run ? 'run' : 'yard', left, right, top, bottom, home, entrance, direction, tiles, spots, reused, phase, built, carried, elapsedMs, crate }
  const boundary = yardBoundary(yard), expected = boundary.filter(i => i !== entrance && !reused.includes(i))
  if (!tiles.length || new Set(reused).size !== reused.length || reused.some(i => !boundary.includes(i) || i === entrance || !(world.project!.tiles.includes(i) || (run && world.yard && [...world.yard.reused, ...world.yard.tiles.slice(0, world.yard.built)].includes(i)))) || (run ? yardInterior(yard, home) : !yardInterior(yard, home)) || !yardInterior(yard, world.coopProject!.tiles[0]) || !boundary.includes(entrance) || !neighboringTiles(entrance).some(i => yardInterior(yard, i)) || tiles.length !== expected.length || (version >= 35 ? new Set(tiles).size !== tiles.length || tiles.some(i => !expected.includes(i)) : tiles.some((i, n) => i !== expected[n])) || spots.some((i, n) => boundary.includes(i) || !neighboringTiles(tiles[n]).includes(i))) v.invalid('yard', 'invalid enclosure geometry, entrance or fence reuse')
  if (r.deferredWork !== undefined) {
    yard.deferredWork = v.array(r.deferredWork, 'yard.deferredWork', undefined, tiles.length).map(value => {
      const work = v.object(value, 'yard.deferredWork', ['tile', 'elapsedMs'])
      const tile = v.tile(work.tile, 'yard.deferredWork.tile'), elapsedMs = v.number(work.elapsedMs, 'yard.deferredWork.elapsedMs', 50, 3950, true)
      if (elapsedMs % 50 || !tiles.slice(built).includes(tile) || (phase === 'building' && tile === tiles[built])) v.invalid('yard.deferredWork', 'partial work must belong to a different unfinished section')
      return { tile, elapsedMs }
    })
    if (!yard.deferredWork.length || new Set(yard.deferredWork.map(work => work.tile)).size !== yard.deferredWork.length) v.invalid('yard.deferredWork', 'expected unique unfinished sections')
  }
  if (elapsedMs % 50 || (phase === 'collecting' ? built >= tiles.length || carried !== 0 || elapsedMs !== 0 : phase === 'building' ? built >= tiles.length || carried !== 2 || crate !== null : built !== tiles.length || carried !== 0 || elapsedMs !== 0 || crate !== null)) v.invalid('yard', 'invalid construction progress or Wood accounting')
  if (world.water[entrance] || (world.buildings[entrance] && world.buildings[entrance]?.kind !== 'peteGate')) v.invalid('yard.entrance', 'reserved entrance must stay open and dry')
  if (crate !== null && world.buildings[crate]?.kind !== 'supplyCrate') v.invalid('yard.crate', 'missing supply crate')
  return yard
}
export function validateFenceOwnership(world: World): void {
  for (let i = 0; i < world.buildings.length; i++) {
    const b = world.buildings[i]
    if (b?.kind !== 'peteFence') continue
    if (world.project?.tiles.slice(0, world.project.built).includes(i) && b.direction === world.project.direction) continue
    if (world.yard?.tiles.slice(0, world.yard.built).includes(i) && b.direction === yardDirection(world.yard, i)) continue
    if (world.chickenRun?.tiles.slice(0, world.chickenRun.built).includes(i) && b.direction === yardDirection(world.chickenRun, i)) continue
    v.invalid('project', 'fence disagrees with completed construction')
  }
}
