import { PETE_PROJECTS, projectUnlocked, retiredIndustrial } from './projectRegistry'
import { developmentFocus } from './developmentFocus'
import { projectResources } from './secretProject'
import { materialDemand } from './materialPolicy'
import type { SupplyCrate, World } from './world'
export function projectDemand(world: World, store: SupplyCrate) {
  const focus = developmentFocus(world)
  const goal = PETE_PROJECTS.find(p => p.id === world.homestead?.priority && world[p.state]?.phase !== 'complete') ??
    (focus && PETE_PROJECTS.find(p => p.path === focus.path && !p.repeatable && !retiredIndustrial(world, p) && world[p.state]?.phase !== 'complete' && projectUnlocked(world, p)))
  if (!goal) return null
  const saved = world[goal.state]
  const resources = saved ? projectResources(saved) : goal.resources
  const paid = world[goal.state]?.phase === 'building'
  return { id: goal.id, paid, ...materialDemand(store, resources, paid) }
}
