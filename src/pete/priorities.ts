import { PETE_PROJECTS, projectUnlocked } from '../simulation/projectRegistry'
import type { World } from '../simulation/world'

// A new wish never discards paid work, carried stock or an in-flight delivery.
export function prioritizeProject(world: World, id: string | null): boolean {
  const h = world.homestead
  if (!h || !world.miniFactory) return false
  if (id !== null) {
    const definition = PETE_PROJECTS.find(p => p.id === id && !p.repeatable)
    if (!definition || !projectUnlocked(world, definition)) return false
  }
  h.priority = id
  return true
}
