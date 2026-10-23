import { HARVEST_MS, HARVEST_COOLDOWN_MS, HARVEST_WOOD } from '../simulation/forestry'
import { MATURE_TREE_MS, TREE_SPECIES } from '../simulation/nature'
import { neighboringTiles } from '../simulation/navigation'
import type { SecretProject } from '../simulation/secretProject'
import type { World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import { restoreEcoDeadline, restoreProjectSelection } from './projectValidation'
import * as v from './validation'
export function restoreHarvest(value: unknown, world: World): SecretProject {
  const r = v.object(value, 'game.harvestProject', ['kind', 'home', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'elapsedMs', 'completedCycles', 'manualCycles', 'treeBornAtMs', 'treeSpecies', 'treeOrigin'], ['selected', 'readyAtMs'])
  const home = v.tile(r.home, 'harvestProject.home'), tiles = v.array(r.tiles, 'harvestProject.tiles', 1).map(i => v.tile(i, 'harvestProject.tile')), spots = v.array(r.spots, 'harvestProject.spots', 1).map(i => v.tile(i, 'harvestProject.spot'))
  const distance = Math.max(Math.abs(home % SIZE - tiles[0] % SIZE), Math.abs(Math.floor(home / SIZE) - Math.floor(tiles[0] / SIZE)))
  if (r.kind !== 'fell' || r.direction !== 'east' || distance < 1 || distance > 6 || !neighboringTiles(tiles[0]).includes(spots[0])) v.invalid('harvestProject', 'invalid local tree geometry')
  const treeBornAtMs = v.number(r.treeBornAtMs, 'harvestProject.treeBornAtMs', r.treeOrigin === 'natural' ? -MATURE_TREE_MS : 0, world.timeMs - MATURE_TREE_MS, true), treeSpecies = v.choice(r.treeSpecies, 'harvestProject.treeSpecies', TREE_SPECIES), treeOrigin = v.choice(r.treeOrigin, 'harvestProject.treeOrigin', ['natural', 'manual'] as const)
  const phase = v.choice(r.phase, 'harvestProject.phase', ['collecting', 'building', 'complete'] as const), built = v.count(r.built, 'harvestProject.built', 1), carried = v.count(r.carried, 'harvestProject.carried', HARVEST_WOOD), elapsedMs = v.count(r.elapsedMs, 'harvestProject.elapsedMs', HARVEST_MS - 50)
  const crate = r.crate === null ? null : v.tile(r.crate, 'harvestProject.crate'), completedCycles = v.count(r.completedCycles, 'harvestProject.completedCycles', Math.floor(world.timeMs / HARVEST_MS)), manualCycles = v.count(r.manualCycles, 'harvestProject.manualCycles', completedCycles + (phase === 'collecting' ? 1 : 0))
  if (treeBornAtMs % 50 || elapsedMs % 50 || built !== (phase === 'complete' ? 1 : 0) || carried !== (phase === 'collecting' ? HARVEST_WOOD : 0) || (phase !== 'building' && elapsedMs !== 0) || (phase !== 'collecting' && crate !== null) || (crate !== null && world.buildings[crate]?.kind !== 'supplyCrate') || (phase === 'complete' && completedCycles < 1)) v.invalid('harvestProject', 'invalid Wood accounting, work or harvest count')
  return { kind: 'fell', home, direction: 'east', tiles, spots, phase, built, carried, elapsedMs, crate, completedCycles, manualCycles, treeBornAtMs, treeSpecies, treeOrigin, ...restoreProjectSelection(r), ...restoreEcoDeadline(r, world, HARVEST_COOLDOWN_MS) }
}
