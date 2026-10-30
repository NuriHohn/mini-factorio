import { PETE_PROJECTS, materialPath } from './projectRegistry'
import { ITEMS } from './items'
import { treeStage } from './nature'
import type { PersonalityPath } from './personality'
import { SIZE } from './world'
import type { World } from './world'

// Compare useful project-sized supplies, not raw units (two cables = one plate).
export function resourcePreference(world: World, path: PersonalityPath): number {
  const home = world.peace.home
  if (home === null) return 1
  let supply = 0
  for (let tile = 0; tile < world.buildings.length; tile++) {
    if (Math.max(Math.abs(tile % SIZE - home % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(home / SIZE))) > 11) continue
    const b = world.buildings[tile]
    if (b?.kind === 'supplyCrate' || b?.kind === 'fuelDepot') {
      if (path === 'eco' && b.kind === 'supplyCrate') supply += b.wood / 6
      for (const item of ITEMS) if (item !== 'wood' && materialPath(world, item) === path) supply += b.inventory[item] / (item === 'copperCable' ? 12 : 6)
    }
    if (path === 'eco' && b?.kind === 'tree' && treeStage(world, b) === 'mature') supply += .1
    if (!world.water[tile] && !b && ((path === 'craftsman' && world.tiles[tile] === 'iron') || (path === 'inventor' && world.tiles[tile] === 'copper') || (path === 'industrial' && world.tiles[tile] === 'coal'))) supply += .1
  }
  return 1 + 2 * supply / (supply + 8)
}

export function preferredPaths(world: World): PersonalityPath[] {
  const goal = PETE_PROJECTS.find(p => p.id === world.homestead?.priority && world[p.state]?.phase !== 'complete')
  if (goal) return [goal.path, ...(['eco', 'craftsman', 'inventor', 'industrial'] as const).filter(path => path !== goal.path)]
  const paths: PersonalityPath[] = ['eco', 'craftsman', 'inventor']
  if (resourcePreference(world, 'industrial') > 1) paths.push('industrial')
  const weights = paths.map(path => resourcePreference(world, path))
  const available = paths.filter((_, i) => weights[i] > 1)
  if (available.length <= 1) return available.length ? [available[0], ...paths.filter(path => path !== available[0])] : [...paths]
  world.peace.seed = (Math.imul(1664525, world.peace.seed) + 1013904223) >>> 0
  let roll = world.peace.seed / 4294967296 * weights.reduce((a, b) => a + b, 0)
  const first = paths.find((_, i) => { roll -= weights[i]; return roll < 0 }) ?? 'eco'
  return [first, ...paths.filter(path => path !== first)]
}
