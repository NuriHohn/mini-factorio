import { recordProduction } from './analytics'
import { changeCraftingRecipe } from './crafting'
import { forestTiles } from './forestryStation'
import { planHarvest } from './forestry'
import { treeStage } from './nature'
import { arrived, begin, finish, freeSite, materialStore } from './homestead'
import { emptyInventory, inventoryTotal } from './items'
import type { Inventory, Item } from './items'
import { miniApproach } from './petesWorld'
import { awardActivity } from './personality'
import { supplyCapacity } from './supplyCrate'
import { deliverItem } from './transport'
import { inside, offsets, placeBuilding, SIZE } from './world'
import type { BuildingKind, Direction, World } from './world'

export const IMPROVEMENTS = ['coopAwning', 'gardenBench', 'storeShelves', 'gardenBoxes'] as const
export type Improvement = typeof IMPROVEMENTS[number]
export const IMPROVEMENT_RULES: Record<Improvement, { label: string; item: Item; amount: number; xp: number }> = {
  coopAwning: { label: 'Vordach am Hühnerstall', item: 'woodPanel', amount: 6, xp: 8 },
  gardenBench: { label: 'Gartenbank', item: 'woodPanel', amount: 6, xp: 8 },
  storeShelves: { label: 'Lagerregale', item: 'woodenCrate', amount: 4, xp: 12 },
  gardenBoxes: { label: 'Pflanzkästen am Garten', item: 'woodenCrate', amount: 3, xp: 12 },
}
export const CHAIN_KINDS = ['forestry', 'crates', 'iron'] as const
export type ChainKind = typeof CHAIN_KINDS[number]
export interface ExpansionPlan { kind: ChainKind; anchor: number; direction: Direction; built: number }
export interface HomesteadExpansion {
  improvements: Partial<Record<Improvement, number>>
  improvement: Improvement | null
  plan: ExpansionPlan | null
  forestry: number | null
  assembler: number | null
  furnace: number | null
}
export function createExpansion(): HomesteadExpansion { return { improvements: {}, improvement: null, plan: null, forestry: null, assembler: null, furnace: null } }
export function expansionLayout(plan: ExpansionPlan): { tile: number; kind: BuildingKind; direction: Direction }[] {
  const a = plan.anchor, d = plan.direction, step = offsets[d].y * SIZE + offsets[d].x
  if (plan.kind === 'forestry') return [{ tile: a, kind: 'forester', direction: d }, { tile: a + step, kind: 'belt', direction: d }]
  const row = d === 'north' ? -SIZE : SIZE
  if (plan.kind === 'crates') return [{ tile: a + row, kind: 'powerPole', direction: 'east' }, { tile: a + row + 1, kind: 'generator', direction: 'east' }, { tile: a - 1, kind: 'belt', direction: 'east' }, { tile: a, kind: 'assembler', direction: 'east' }]
  return [{ tile: a + row, kind: 'powerPole', direction: 'east' }, { tile: a + row + 1, kind: 'generator', direction: 'east' }, { tile: a, kind: 'furnace', direction: 'east' }]
}
export function chainCost(kind: ChainKind): Partial<Inventory> { return kind === 'iron' ? { iron: 6 } : kind === 'forestry' ? { woodPanel: 8, wood: 1 } : { woodPanel: 12 } }
function improvementSite(world: World, id: Improvement): number | null {
  const p = id === 'coopAwning' ? world.coopProject : id === 'gardenBench' || id === 'gardenBoxes' ? world.gardenProject : null
  return id === 'storeShelves' ? world.homestead!.store : p?.phase === 'complete' && world.buildings[p.tiles[0]] ? p.tiles[0] : null
}
export function ironSite(world: World): number | null {
  const home = world.peace.home
  if (home === null) return null
  return world.tiles.map((ore, tile) => ({ ore, tile, distance: Math.abs(tile % SIZE - world.pete.tile % SIZE) + Math.abs(Math.floor(tile / SIZE) - Math.floor(world.pete.tile / SIZE)) }))
    .filter(p => p.ore === 'iron' && !world.water[p.tile] && !world.buildings[p.tile] && Math.max(Math.abs(p.tile % SIZE - home % SIZE), Math.abs(Math.floor(p.tile / SIZE) - Math.floor(home / SIZE))) <= 11)
    .sort((a, b) => a.distance - b.distance || a.tile - b.tile).find(p => miniApproach(world, p.tile) !== null)?.tile ?? null
}
function chainCandidates(world: World, kind: ChainKind): ExpansionPlan[] {
  const h = world.homestead!, candidates: ExpansionPlan[] = []
  if (kind === 'forestry' && h.millAnchor !== null) {
    for (const direction of ['east', 'south', 'north'] as const) {
      const d = offsets[direction], a = h.millAnchor - 2 * (d.y * SIZE + d.x)
      if (Math.abs(a % SIZE - h.millAnchor % SIZE) > 2) continue
      candidates.push({ kind, anchor: a, direction, built: 0 })
    }
  } else if (kind === 'crates' && h.millAnchor !== null && h.millAnchor % SIZE < SIZE - 3) {
    for (const direction of ['north', 'south'] as const) candidates.push({ kind, anchor: h.millAnchor + 2, direction, built: 0 })
  }
  else if (kind === 'iron') {
    const home = world.peace.home!
    for (let radius = 3; radius <= 7; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
      const x = home % SIZE + dx, y = Math.floor(home / SIZE) + dy
      if (x > 0 && x < SIZE - 2 && y > 0 && y < SIZE - 2) for (const direction of ['north', 'south'] as const) candidates.push({ kind, anchor: y * SIZE + x, direction, built: 0 })
    }
  }
  return candidates.filter(p => expansionLayout(p).every(s => inside(s.tile % SIZE, Math.floor(s.tile / SIZE))))
}
function planChain(world: World, kind: ChainKind): ExpansionPlan | null {
  return chainCandidates(world, kind).find(p => freeSite(world, expansionLayout(p).map(s => s.tile))) ?? null
}
function clearForestrySite(world: World): boolean {
  for (const plan of chainCandidates(world, 'forestry')) {
    const tiles = expansionLayout(plan).map(s => s.tile), buildings = [...world.buildings]
    for (const tile of tiles) { const b = buildings[tile]; if (b?.kind === 'tree' && treeStage(world, b) === 'mature') buildings[tile] = null }
    if (!freeSite({ ...world, buildings, harvestProject: undefined }, tiles)) continue
    const project = planHarvest(world, tiles)
    if (!project) continue
    world.harvestProject = project; project.selected = true
    Object.assign(world.peace, { activity: 'project', destination: null, sinceMs: world.timeMs, untilMs: world.timeMs })
    return true
  }
  return false
}
export function chooseExpansion(world: World): boolean {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)
  if (!store) {
    const tile = ironSite(world)
    if (!h.carried.wood && tile !== null) { begin(world, 'mineIron', tile); return true }
    return false
  }
  if (e.plan) { begin(world, 'buildChain', h.store); return true }
  const eco = world.personality.paths.eco.level, craftsman = world.personality.paths.craftsman.level
  // Take turns across the two paths; each commitment yields to daily life afterwards.
  if (craftsman >= 2 && e.furnace === null && store.inventory.iron >= 6) {
    const plan = planChain(world, 'iron')
    if (plan) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
  }
  if (eco >= 3 && store.storeTier !== 0) for (const id of IMPROVEMENTS) {
    if (e.improvements[id] !== undefined || ((id === 'storeShelves' || id === 'gardenBoxes') && eco < 4)) continue
    const tile = improvementSite(world, id), rule = IMPROVEMENT_RULES[id]
    if (tile !== null && store.inventory[rule.item] >= rule.amount) { e.improvement = id; begin(world, 'improve', h.store); return true }
  }
  if (eco >= 4 && h.millBuilt === 3 && store.storeTier !== 0) for (const kind of ['forestry', 'crates'] as const) {
    if (kind === 'crates' && e.forestry === null) continue
    if ((kind === 'forestry' ? e.forestry : e.assembler) !== null || Object.entries(chainCost(kind)).some(([item, amount]) => (item === 'wood' ? store.wood : store.inventory[item as Item]) < amount)) continue
    const plan = planChain(world, kind)
    if (plan) { e.plan = plan; begin(world, 'buildChain', h.store); return true }
    if (kind === 'forestry' && clearForestrySite(world)) return true
  }
  const furnace = e.furnace === null ? null : world.buildings[e.furnace]
  if (furnace?.kind === 'furnace' && store.inventory.ironPlate < 40) {
    if (furnace.output.ironPlate && store.wood + inventoryTotal(store.inventory) + 2 <= supplyCapacity(store)) { begin(world, 'takeIron', e.furnace); return true }
    if (!furnace.job && !furnace.input.iron && store.inventory.iron >= 2) { begin(world, 'fetchIron', h.store); return true }
  }
  const assembler = e.assembler === null ? null : world.buildings[e.assembler]
  if (assembler?.kind === 'assembler' && assembler.output.woodenCrate && store.inventory.woodenCrate < 8 && store.wood + inventoryTotal(store.inventory) + 2 <= supplyCapacity(store)) { begin(world, 'takeCrates', e.assembler); return true }
  if (store.inventory.iron < 24 && store.wood + inventoryTotal(store.inventory) + 3 <= supplyCapacity(store) && (furnace?.kind !== 'furnace' || store.inventory.ironPlate < 40)) {
    const tile = ironSite(world)
    if (tile !== null) { begin(world, 'mineIron', tile); return true }
  }
  return false
}
export function advanceExpansion(world: World, delta: number): boolean {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)
  if (h.task === 'mineIron') {
    if (h.target === null || world.tiles[h.target] !== 'iron' || world.water[h.target] || world.buildings[h.target]) { h.elapsedMs = 0; const tile = ironSite(world); if (tile === null) { if (inventoryTotal(h.carried) && store) begin(world, 'returnStock', h.store); else if (!inventoryTotal(h.carried)) finish(world); return true } h.target = tile }
    if (!arrived(world, h.target, delta)) return true
    h.elapsedMs = Math.min(6000, h.elapsedMs + delta)
    if (h.elapsedMs === 6000) {
      h.carried.iron += 3; world.mined.iron += 3; recordProduction(world, { iron: 3 }); h.elapsedMs = 0
      if (store) begin(world, 'returnStock', h.store)
      else if (h.carried.iron >= 6) { h.task = 'gather'; h.target = null } // Bootstrap chooses a paid store site next.
    }
    return true
  }
  if (!['buildChain', 'improve', 'fetchIron', 'feedIron', 'takeIron', 'takeCrates'].includes(h.task ?? '')) return false
  if (!store) return true
  if (h.task === 'buildChain') {
    const plan = e.plan
    if (!plan) return true
    const cost = Object.entries(chainCost(plan.kind)) as [Item, number][]
    if (!inventoryTotal(h.carried)) {
      if (!arrived(world, h.store, delta) || cost.some(([item, amount]) => (item === 'wood' ? store.wood : store.inventory[item]) < amount)) return true
      for (const [item, amount] of cost) { if (item === 'wood') store.wood -= amount; else store.inventory[item] -= amount; h.carried[item] = amount }
    }
    const step = expansionLayout(plan)[plan.built]
    if (!step || world.buildings[step.tile] || world.water[step.tile] || !arrived(world, step.tile, delta) || !freeSite(world, [step.tile])) return true
    h.target = step.tile; h.elapsedMs = Math.min(4000, h.elapsedMs + delta)
    if (h.elapsedMs !== 4000 || !placeBuilding(world, step.tile % SIZE, Math.floor(step.tile / SIZE), step.kind, step.direction)) return true
    if (step.kind === 'assembler') changeCraftingRecipe(world, step.tile % SIZE, Math.floor(step.tile / SIZE), 'woodenCrate')
    plan.built++; h.elapsedMs = 0
    if (plan.built === expansionLayout(plan).length) {
      const leftover = emptyInventory()
      if (plan.kind === 'forestry') {
        e.forestry = plan.anchor
        const station = world.buildings[plan.anchor]
        if (station?.kind === 'forester') {
          // Preserve output gathered while a later build step was blocked.
          if (station.output.wood < 6) station.output.wood++
          else leftover.wood = 1
          const plot = forestTiles(station).find(i => !world.tiles[i] && freeSite(world, [i]))
          if (plot !== undefined && !station.plots.includes(plot) && station.plots.length < 48) station.plots.push(plot)
        }
      }
      else if (plan.kind === 'crates') e.assembler = plan.anchor
      else e.furnace = plan.anchor
      h.carried = leftover; awardActivity(world.personality, { path: plan.kind === 'iron' ? 'craftsman' : 'eco', xp: 12 }); e.plan = null
      if (inventoryTotal(leftover)) begin(world, 'returnStock', h.store)
      else finish(world)
    }
    return true
  }
  if (h.task === 'improve') {
    const id = e.improvement
    if (!id) return true
    const rule = IMPROVEMENT_RULES[id], tile = improvementSite(world, id)
    if (!inventoryTotal(h.carried)) {
      if (!arrived(world, h.store, delta) || store.inventory[rule.item] < rule.amount) return true
      store.inventory[rule.item] -= rule.amount; h.carried[rule.item] = rule.amount
    }
    if (tile === null || !arrived(world, tile, delta)) return true
    h.target = tile; h.elapsedMs = Math.min(8000, h.elapsedMs + delta)
    if (h.elapsedMs === 8000) {
      e.improvements[id] = tile
      if (id === 'storeShelves') store.storeTier = 2
      h.carried = emptyInventory(); e.improvement = null; awardActivity(world.personality, { path: 'eco', xp: rule.xp }); finish(world)
    }
    return true
  }
  if (!arrived(world, h.target, delta)) return true
  const furnace = e.furnace === null ? null : world.buildings[e.furnace], assembler = e.assembler === null ? null : world.buildings[e.assembler]
  if (h.task === 'fetchIron') {
    if (store.inventory.iron < 2 || furnace?.kind !== 'furnace') { finish(world); return true }
    store.inventory.iron -= 2; h.carried.iron = 2; begin(world, 'feedIron', e.furnace)
  } else if (h.task === 'feedIron') {
    if (furnace?.kind !== 'furnace') { begin(world, 'returnStock', h.store); return true }
    while (h.carried.iron && deliverItem(furnace, 'iron', 'east')) h.carried.iron--
    if (!h.carried.iron) finish(world)
    else begin(world, 'returnStock', h.store)
  } else {
    const machine = h.task === 'takeIron' ? furnace : assembler, item = h.task === 'takeIron' ? 'ironPlate' : 'woodenCrate'
    if ((machine?.kind !== 'furnace' && machine?.kind !== 'assembler') || !machine.output[item]) { finish(world); return true }
    const amount = Math.min(2, machine.output[item]); machine.output[item] -= amount; h.carried[item] = amount; begin(world, 'returnStock', h.store)
  }
  return true
}
export function expansionSummary(world: World): string {
  const h = world.homestead!, e = h.expansion, store = materialStore(world)
  if (h.task === 'buildChain' && e.plan) {
    const step = expansionLayout(e.plan)[e.plan.built]
    if (step && (world.buildings[step.tile] || world.water[step.tile] || miniApproach(world, step.tile) === null)) return 'Mein nächster Bauplatz oder Weg ist blockiert. Bezahltes Material und Baufortschritt bleiben erhalten.'
    return `Ich baue ${e.plan.kind === 'forestry' ? 'Forststation und Förderband' : e.plan.kind === 'crates' ? 'den Assembler für Holzkisten' : 'meinen Schmelzofen'} · ${e.plan.built}/${expansionLayout(e.plan).length}. Bezahltes Material bleibt erhalten.`
  }
  if (h.task === 'improve' && e.improvement) return improvementSite(world, e.improvement) === null ? 'Das Gebäude für meine Verbesserung fehlt. Ich behalte das bereits abgeholte Material.' : `Ich baue: ${IMPROVEMENT_RULES[e.improvement].label}.`
  const missing = IMPROVEMENTS.find(id => e.improvements[id] === undefined && improvementSite(world, id) !== null)
  const rule = missing ? IMPROVEMENT_RULES[missing] : null
  return `${rule ? `${rule.label}: ${store?.inventory[rule.item] ?? 0}/${rule.amount} ${rule.item === 'woodPanel' ? 'Holzplatten' : 'Holzkisten'}. ` : ''}Forststation und Holzkisten ab Öko 4 mit freiem Bauplatz am Sägewerk. Eisenabbau ab Stufe 1, Schmelzofen ab Handwerker 2.`
}
export function expansionProjects(world: World): string[] {
  const h = world.homestead
  if (!h) return []
  const store = materialStore(world)
  return IMPROVEMENTS.map(id => {
    const rule = IMPROVEMENT_RULES[id]
    return `${rule.label}: ${h.expansion.improvements[id] !== undefined ? 'fertig' : `${store?.inventory[rule.item] ?? 0}/${rule.amount} ${rule.item === 'woodPanel' ? 'Holzplatten' : 'Holzkisten'}${improvementSite(world, id) === null ? ' · zuerst das Grundprojekt bauen' : ''}`}`
  })
}
