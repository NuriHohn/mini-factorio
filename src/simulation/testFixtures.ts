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
