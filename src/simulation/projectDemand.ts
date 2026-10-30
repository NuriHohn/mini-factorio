import { PETE_PROJECTS } from './projectRegistry'
import { projectResources } from './secretProject'
import { ITEMS } from './items'
import type { Inventory } from './items'
import type { SupplyCrate, World } from './world'
export function projectDemand(world: World, store: SupplyCrate) {
  const goal = PETE_PROJECTS.find(p => p.id === world.homestead?.priority && world[p.state]?.phase !== 'complete')
  if (!goal) return null
  const saved = world[goal.state]
  const resources = saved ? projectResources(saved) : goal.resources
  const costs: Partial<Inventory> = {}
  const reserved: Partial<Inventory> = {}
  const missing: Partial<Inventory> = {}
  const paid = world[goal.state]?.phase === 'building'
  for (const item of ITEMS) {
    const amount = resources[item] ?? 0
    if (!amount) continue
    costs[item] = amount
    reserved[item] = paid ? 0 : Math.min(amount, item === 'wood' ? store.wood : store.inventory[item])
    missing[item] = paid ? 0 : amount - reserved[item]!
  }
  return { id: goal.id, paid, costs, reserved, missing }
}
