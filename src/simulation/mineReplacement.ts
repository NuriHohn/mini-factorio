import { DEPOSIT_WARNING, oreRemaining, retireMiningRoute } from './deposits'
import { arrived, begin, finish, materialStore } from './homestead'
import { chainCost, expansionLayout, planOreMining } from './homesteadExpansion'
import type { ExpansionPlan } from './homesteadExpansion'
import { planIndustrial } from './industrial'
import type { Item } from './items'
import { ensureRebuilding } from './rebuilding'
import { miniApproach } from './petesWorld'
import type { World } from './world'

const MINES = [
  { key: 'miner', ore: 'iron', kind: 'ironMining', target: 'furnace' },
  { key: 'copperMiner', ore: 'copper', kind: 'copperMining', target: 'copperFurnace' },
  { key: 'coalMiner', ore: 'coal', kind: 'coalMining', target: 'fuelStore' },
] as const

function rememberMineDevelopment(world: World, key: 'miner' | 'copperMiner' | 'coalMiner'): void {
  const r = ensureRebuilding(world), id = `chain:${key}`
  // Legacy repair registries may predate construction of this original mine.
  if (!r.rewarded.includes(id)) r.rewarded.push(id)
}

export function chooseMineReplacement(world: World): boolean {
  const h = world.homestead, d = world.deposits, store = materialStore(world)
  if (!h || !d || !store || h.expansion.plan) return false
  const e = h.expansion
  for (const mine of MINES) {
    const old = e[mine.key], destination = e[mine.target]
    if (old === null || destination === null || world.buildings[old]?.kind !== 'miner' || (oreRemaining(world, old) ?? Infinity) > DEPOSIT_WARNING) continue
    const target = mine.ore === 'coal' ? destination : destination - 1
    const plan = mine.ore === 'coal' ? planIndustrial(world, 'coalMining') : planOreMining(world, mine.ore, true)
    if (plan && Object.entries(chainCost(plan.kind)).every(([item, amount]) => store.inventory[item as Item] >= amount)) {
      e.plan = plan
      begin(world, 'buildChain', h.store)
      return true
    }
    if (!world.tiles[old]) {
      rememberMineDevelopment(world, mine.key)
      retireMiningRoute(world, old, target, [])
      e[mine.key] = null
    }
  }
  // An entire obsolete branch drains before its first part is removed. Removing
  // an empty downstream belt earlier could strand a packet still upstream.
  if (d.retiring.length && d.retiring.every(tile => {
    const b = world.buildings[tile]
    return !b || (b.kind === 'miner' || b.kind === 'belt') && !b.item
  })) {
    const tile = d.retiring.find(tile => miniApproach(world, tile) !== null)
    if (tile !== undefined) { begin(world, 'retireMine', tile); return true }
  }
  return false
}

export function finishMineReplacement(world: World, plan: ExpansionPlan): void {
  if (!world.deposits) return
  const mine = MINES.find(m => m.kind === plan.kind), e = world.homestead!.expansion
  if (!mine) return
  const old = e[mine.key], destination = e[mine.target]
  const retained = expansionLayout(plan).map(p => p.tile)
  world.deposits.retiring = world.deposits.retiring.filter(tile => !retained.includes(tile))
  if (old === null || old === plan.anchor || destination === null) return
  rememberMineDevelopment(world, mine.key)
  retireMiningRoute(world, old, mine.ore === 'coal' ? destination : destination - 1, retained)
}

export function advanceMineRetirement(world: World, delta: number): boolean {
  const h = world.homestead!, d = world.deposits
  if (h.task !== 'retireMine') return false
  const tile = h.target
  if (!d || tile === null || !d.retiring.includes(tile)) { finish(world); return true }
  const b = world.buildings[tile]
  if (!b) { d.retiring = d.retiring.filter(t => t !== tile); finish(world); return true }
  if ((b.kind !== 'miner' && b.kind !== 'belt') || b.item) { finish(world); return true }
  if (miniApproach(world, tile) === null) { finish(world); return true }
  if (!arrived(world, tile, delta)) return true
  h.elapsedMs = Math.min(4000, h.elapsedMs + delta)
  if (h.elapsedMs < 4000) return true
  // No demolition callback: an intentionally retired component is not a repair.
  world.buildings[tile] = null
  delete world.analytics.machines[tile]
  d.retiring = d.retiring.filter(t => t !== tile)
  world.topologyRevision++
  finish(world)
  return true
}

export function miningStatus(world: World): string | null {
  if (!world.deposits || !world.homestead) return null
  const h = world.homestead
  if (h.task === 'retireMine') return 'Ich räume die geleerte alte Förderstrecke auf. Die Stromversorgung bleibt erhalten.'
  if (h.expansion.plan?.reuse) return 'Ich erschließe eine Ersatzquelle und verwende passende Förderstrecken weiter. Die alte Mine liefert während des Baus weiter.'
  if (h.task && !['gather', 'mineIron', 'mineCopper', 'mineCoal'].includes(h.task)) return null
  const names = { iron: 'Eisen', copper: 'Kupfer', coal: 'Kohle' }
  const warnings = MINES.flatMap(m => {
    const tile = h.expansion[m.key]
    if (tile === null) return []
    const remaining = oreRemaining(world, tile)
    return remaining !== null && remaining <= DEPOSIT_WARNING ? [`${names[m.ore]}: ${remaining} übrig · ich suche einen erreichbaren Ersatz mit freier Bandstrecke und Baumaterial`] : []
  })
  if (warnings.length) return warnings.join(' · ')
  // A missing source is a local blocker, not a command to suspend other work.
  const missing = MINES.filter(m => (m.ore === 'coal' ? h.expansion.steamEngine : h.expansion[m.target]) !== null && !world.tiles.some((ore, tile) => ore === m.ore && !world.water[tile])).map(m => names[m.ore])
  return missing.length ? `${missing.join(', ')}: kein trockenes Vorkommen mehr. Platziere eine neue Quelle; ich arbeite inzwischen an anderen möglichen Aufgaben.` : null
}
