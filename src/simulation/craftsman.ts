import { connectionRunning } from './infrastructure'
import { arrived, begin, finish, materialStore } from './homestead'
import { planChain } from './homesteadExpansion'
import { inventoryTotal } from './items'
import { deliverItem } from './transport'
import { awardActivity } from './personality'
import { awardHomesteadOnce, ensureRebuilding } from './rebuilding'
import { supplyCapacity } from './supplyCrate'
import type { World } from './world'

export function cargoBicycleAvailable(world: World): boolean {
  const p = world.bicycleProject
  return !!world.homestead?.cargoBicycle && p?.phase === 'complete' && world.buildings[p.tiles[0]]?.kind === 'peteDevelopment'
}
export function chooseCraftsman(world: World): boolean {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)!, level = world.personality.paths.craftsman.level
  if (level >= 3 && e.miner !== null && world.verandaProject?.phase === 'complete' && e.gearAssembler === null && store.inventory.ironPlate >= 8) {
    const plan = planChain(world, 'gears')
    if (plan) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
  }
  const bike = world.bicycleProject
  if (level >= 4 && !h.cargoBicycle && bike?.phase === 'complete' && world.buildings[bike.tiles[0]]?.kind === 'peteDevelopment' && store.inventory.ironPlate >= 12 && store.inventory.ironGear >= 6) {
    begin(world, 'upgradeBicycle', bike.tiles[0]); return true
  }
  const machine = e.gearAssembler === null ? null : world.buildings[e.gearAssembler]
  if (machine?.kind !== 'assembler' || store.inventory.ironGear >= 12) return false
  if (!connectionRunning(world, 'gearReturn') && machine.output.ironGear && store.wood + inventoryTotal(store.inventory) + 2 <= supplyCapacity(store)) { begin(world, 'takeGear', e.gearAssembler); return true }
  const reserve = world.verandaProject?.phase !== 'complete' ? 20 : bike?.phase !== 'complete' ? 24 : !h.cargoBicycle ? 12 : 2
  if (!connectionRunning(world, 'gearFeed') && !machine.job && machine.input.ironPlate < 2 && store.inventory.ironPlate >= reserve + 2) { begin(world, 'fetchGear', h.store); return true }
  return false
}
export function advanceCraftsman(world: World, delta: number): boolean {
  const h = world.homestead!, store = materialStore(world)
  if (!['fetchGear', 'feedGear', 'takeGear', 'upgradeBicycle'].includes(h.task ?? '')) return false
  if (h.task === 'upgradeBicycle') {
    if (!inventoryTotal(h.carried)) {
      if (!store || !arrived(world, h.store, delta)) return true
      if (store.inventory.ironPlate < 12 || store.inventory.ironGear < 6) { finish(world); return true }
      store.inventory.ironPlate -= 12; store.inventory.ironGear -= 6
      h.carried.ironPlate = 12; h.carried.ironGear = 6
    }
    if (world.buildings[h.target!]?.kind !== 'peteDevelopment' || !arrived(world, h.target, delta)) return true
    h.elapsedMs = Math.min(8000, h.elapsedMs + delta)
    if (h.elapsedMs === 8000) {
      h.carried.ironPlate = 0; h.carried.ironGear = 0; h.cargoBicycle = true; h.bikeTile = world.pete.tile
      ensureRebuilding(world); awardHomesteadOnce(world, 'cargoBicycle', { path: 'craftsman', xp: 20 }); finish(world)
    }
    return true
  }
  if (!store || !arrived(world, h.target, delta)) return true
  const machine = h.expansion.gearAssembler === null ? null : world.buildings[h.expansion.gearAssembler]
  if (machine?.kind !== 'assembler') { if (inventoryTotal(h.carried)) begin(world, 'returnStock', h.store); else finish(world); return true }
  if (h.task === 'fetchGear') {
    const amount = Math.max(0, 2 - machine.input.ironPlate)
    if (!amount || store.inventory.ironPlate < amount) { finish(world); return true }
    store.inventory.ironPlate -= amount; h.carried.ironPlate = amount; begin(world, 'feedGear', h.expansion.gearAssembler)
  } else if (h.task === 'feedGear') {
    while (h.carried.ironPlate && deliverItem(machine, 'ironPlate', 'east')) h.carried.ironPlate--
    if (h.carried.ironPlate) begin(world, 'returnStock', h.store); else finish(world)
  } else {
    const amount = Math.min(2, machine.output.ironGear)
    if (!amount) { finish(world); return true }
    machine.output.ironGear -= amount; h.carried.ironGear = amount
    awardActivity(world.personality, { path: 'craftsman', xp: amount }); begin(world, 'returnStock', h.store)
  }
  return true
}
