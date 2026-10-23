import type { World } from './world'
import { createResearch } from './research'
// Shared explicit infrastructure for full-power production regression fixtures.
import { createWorld, placeBuilding } from './world'
import { allocatePower } from './power'
export function poweredWorld(random = Math.random) {
  const world = createUnlockedWorld(random)
  placeBuilding(world, 21, 19, 'powerPole', 'east')
  placeBuilding(world, 21, 18, 'generator', 'east')
  allocatePower(world)
  return world
}

// Existing system regressions exercise their established machines independently
// of progression. New-game/research tests use createWorld directly.
export function createUnlockedWorld(random = Math.random) {
  const world = createWorld(random, { nature: false, water: false })
  world.research = createResearch(true)
  return world
}

export function createBareWorld(random = Math.random) { return createWorld(random, { nature: false, water: false }) }

// Conservation checks in initially treeless construction fixtures include Wood
// legitimately spent on the new Eco activities, separately from the project under test.
export function ecoProjectWood(world: World): number {
  return (world.chickenRun ? world.chickenRun.built * 2 + world.chickenRun.carried : 0) + (world.harvestProject?.manualCycles ?? 0) * 2 - (world.harvestProject?.completedCycles ?? 0) * 3 + (world.careProject?.completedCycles ?? 0) * 2 + (world.careProject?.carried ?? 0) + (world.gardenProject && world.gardenProject.phase !== 'collecting' ? 12 : 0) + (world.plantProject?.carried ?? 0) + 2 * world.buildings.filter(b => b?.kind === 'tree' && b.origin === 'manual').length
}
