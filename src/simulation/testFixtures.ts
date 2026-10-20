// Shared explicit infrastructure for full-power production regression fixtures.
import { createWorld, placeBuilding } from './world'
import { allocatePower } from './power'
export function poweredWorld(random = Math.random) {
  const world = createWorld(random)
  placeBuilding(world, 21, 19, 'powerPole', 'east')
  placeBuilding(world, 21, 18, 'generator', 'east')
  allocatePower(world)
  return world
}
