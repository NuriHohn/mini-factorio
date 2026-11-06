import { transportUnlocked } from './materialPolicy'
import { planChain } from './homesteadExpansion'
import { planConnection, parkForConnection, partComplete } from './infrastructure'
import { linkCost, linkCurrency } from './infrastructureRules'
import { arrived, begin, finish, materialStore } from './homestead'
import { inventoryTotal } from './items'
import type { World } from './world'

export const MODULE_LINKS = ['moduleGearFeed', 'moduleCircuitFeed', 'moduleReturn'] as const
export function chooseTransportModule(world: World, path: string): boolean {
  const h = world.homestead!, store = materialStore(world)
  if (!store || !['craftsman', 'inventor'].includes(path) || !transportUnlocked(world)) return false
  const at = h.expansion.transportAssembler
  if (at === undefined) {
    if (store.inventory.ironPlate < 8 || store.inventory.copperPlate < 8) return false
    const plan = planChain(world, 'transport')
    if (!plan) return false
    h.expansion.plan = plan; begin(world, 'buildChain', h.store); return true
  }
  if (!h.transportUpgrade && store.inventory.transportModule >= 2 && world.bicycleProject?.phase === 'complete' && world.buildings[world.bicycleProject.tiles[0]]?.kind === 'peteDevelopment') {
    begin(world, 'upgradeTransport', world.bicycleProject.tiles[0]); return true
  }
  const s = h.infrastructure
  for (const kind of MODULE_LINKS) {
    const old = s.links.find(p => p.kind === kind)
    const repair = old?.parts.some(p => !partComplete(world, p))
    if (old && !repair || store.inventory[linkCurrency(kind)] < (repair ? 1 : linkCost(kind))) continue
    if (!old && parkForConnection(world, [kind])) return true
    const plan = old ?? planConnection(world, kind)
    if (!plan) continue
    s.plan = structuredClone(plan); s.built = 0; s.repair = !!old; begin(world, 'buildConnection', h.store); return true
  }
  return false
}
export function advanceTransportUpgrade(world: World, delta: number): boolean {
  const h = world.homestead!
  if (h.task !== 'upgradeTransport') return false
  const store = materialStore(world)
  if (!inventoryTotal(h.carried)) {
    if (!store || !arrived(world, h.store, delta)) return true
    if (store.inventory.transportModule < 2) { finish(world); return true }
    store.inventory.transportModule -= 2; h.carried.transportModule = 2
  }
  if (world.buildings[h.target!]?.kind !== 'peteDevelopment' || !arrived(world, h.target, delta)) return true
  h.elapsedMs = Math.min(8000, h.elapsedMs + delta)
  if (h.elapsedMs === 8000) { h.carried.transportModule = 0; h.transportUpgrade = true; finish(world) }
  return true
}
