import { HOME_TASKS } from '../simulation/homestead'
import { CHAIN_KINDS, chainCost, createExpansion, expansionLayout, IMPROVEMENTS, IMPROVEMENT_RULES } from '../simulation/homesteadExpansion'
import type { HomesteadExpansion } from '../simulation/homesteadExpansion'
import type { Homestead } from '../simulation/homestead'
import { ITEMS, inventoryTotal } from '../simulation/items'
import { MATURE_TREE_MS } from '../simulation/nature'
import type { World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import * as v from './validation'

export function restoreHomestead(value: unknown, world: World, version: number): Homestead {
  if (!world.miniFactory || world.peace.home === null) v.invalid('homestead', 'requires Petes Welt and a home')
  const r = v.object(value, 'homestead', ['store', 'task', 'target', 'treeBornAtMs', 'carried', 'elapsedMs', 'nextAtMs', 'millAnchor', 'millBuilt', ...(version >= 41 ? ['expansion'] : [])])
  const expansion = version < 41 ? createExpansion() : restoreExpansion(r.expansion, world, version)
  const nullableTile = (key: string) => r[key] === null ? null : v.tile(r[key], `homestead.${key}`)
  const store = nullableTile('store'), target = nullableTile('target'), millAnchor = nullableTile('millAnchor')
  const task = r.task === null ? null : v.choice(r.task, 'homestead.task', version >= 42 ? HOME_TASKS : HOME_TASKS.filter(t => !['mineCopper', 'fetchCopper', 'feedCopper', 'takeCopper', 'fetchCable', 'feedCable', 'takeCable'].includes(t)))
  const carried = v.inventory(r.carried, 'homestead.carried'), elapsedMs = v.count(r.elapsedMs, 'homestead.elapsedMs', task === 'expandStore' || task === 'improve' ? 8000 : task === 'buildMill' || task === 'buildChain' ? 4000 : 6000)
  const nextAtMs = v.count(r.nextAtMs, 'homestead.nextAtMs', world.timeMs + 10000), millBuilt = v.count(r.millBuilt, 'homestead.millBuilt', 3)
  const treeBornAtMs = r.treeBornAtMs === null ? null : v.number(r.treeBornAtMs, 'homestead.treeBornAtMs', -MATURE_TREE_MS, world.timeMs - MATURE_TREE_MS, true)
  if (elapsedMs % 50 || nextAtMs % 50 || (treeBornAtMs !== null && treeBornAtMs % 50) || ITEMS.some(i => !['wood', 'woodPanel', 'woodenCrate', 'iron', 'ironPlate', 'copper', 'copperPlate', 'copperCable'].includes(i) && carried[i]) || carried.wood > 12 || carried.woodPanel > 12 || carried.woodenCrate > 4 || carried.iron > 6 || carried.ironPlate > 8 || carried.copper > 6 || carried.copperPlate > 8 || carried.copperCable > 2 || (ITEMS.filter(i => carried[i] > 0).length > 1 && !(task === 'buildChain' && expansion.plan?.kind === 'forestry'))) v.invalid('homestead', 'invalid carried stock or clock')
  if (task === null && (elapsedMs || target !== null || treeBornAtMs !== null || inventoryTotal(carried))) v.invalid('homestead', 'idle routine contains committed work')
  if (task !== null && task !== 'gather' && target === null) v.invalid('homestead.target', 'committed work needs a target')
  if ((task !== 'gather' && treeBornAtMs !== null) || (task === 'gather' && (target === null) !== (treeBornAtMs === null))) v.invalid('homestead', 'invalid harvest identity')
  if (store !== null && world.buildings[store] && (world.buildings[store]?.kind !== 'supplyCrate' || world.buildings[store].storeTier === undefined)) v.invalid('homestead.store', 'material store reference disagrees')
  if ((millAnchor === null && millBuilt) || (millAnchor !== null && (millAnchor % SIZE >= SIZE - 1 || Math.floor(millAnchor / SIZE) >= SIZE - 1))) v.invalid('homestead.millAnchor', 'invalid mill layout')
  if (task === 'buildStore' && (store !== null || inventoryTotal(carried) !== 6 || (carried.wood !== 6 && carried.iron !== 6 && carried.copper !== 6))) v.invalid('homestead', 'store requires six paid materials from one path')
  if (task === 'gather' && (inventoryTotal(carried) > 6 || carried.wood % 3 || ((carried.iron && carried.iron !== 6) || (carried.copper && carried.copper !== 6)) || carried.woodPanel || carried.woodenCrate || carried.ironPlate || carried.copperPlate || carried.copperCable)) v.invalid('homestead', 'invalid starter harvest load')
  if (['fetchWood', 'takePanels', 'fetchIron', 'takeIron', 'takeCrates', 'fetchCopper', 'takeCopper', 'fetchCable', 'takeCable'].includes(task ?? '') && inventoryTotal(carried)) v.invalid('homestead', 'uncollected pickup contains material')
  if (task === 'buildMill' && (![0, 12].includes(carried.wood) || inventoryTotal(carried) !== carried.wood || ((millBuilt > 0 || elapsedMs > 0) && carried.wood !== 12))) v.invalid('homestead', 'invalid paid mill construction')
  if (task === 'expandStore' && (target !== store || carried.wood || (elapsedMs > 0 && carried.woodPanel !== 8))) v.invalid('homestead', 'extension work is not funded')
  if (task === 'buildMill' && millAnchor === null) v.invalid('homestead', 'mill construction needs a plan')
  if (task === 'feedMill' && (!carried.wood || carried.wood > 2 || inventoryTotal(carried) !== carried.wood || target !== millAnchor)) v.invalid('homestead', 'missing mill delivery')
  if (task === 'returnStock' && (!inventoryTotal(carried) || target !== store)) v.invalid('homestead', 'missing return payload')
  if (task === 'expandStore' && (![0, 8].includes(carried.woodPanel) || inventoryTotal(carried) !== carried.woodPanel)) v.invalid('homestead', 'invalid paid extension')
  if (task === 'mineIron' && (carried.iron % 3 || inventoryTotal(carried) !== carried.iron)) v.invalid('homestead', 'invalid mined load')
  if (task === 'mineCopper' && (carried.copper % 3 || inventoryTotal(carried) !== carried.copper)) v.invalid('homestead', 'invalid mined copper load')
  if (task === 'feedCopper' && (carried.copper < 1 || carried.copper > 2 || inventoryTotal(carried) !== carried.copper || target !== expansion.copperFurnace)) v.invalid('homestead', 'invalid copper delivery')
  if (task === 'feedCable' && (carried.copperPlate < 1 || carried.copperPlate > 2 || inventoryTotal(carried) !== carried.copperPlate || target !== expansion.cableAssembler)) v.invalid('homestead', 'invalid cable delivery')
  if (task === 'feedIron' && (carried.iron < 1 || carried.iron > 2 || inventoryTotal(carried) !== carried.iron || target !== expansion.furnace)) v.invalid('homestead', 'invalid iron delivery')
  if (task === 'returnStock' && (carried.wood > 3 || carried.woodPanel > 2 || carried.woodenCrate > 2 || carried.iron > 3 || carried.ironPlate > 2 || carried.copper > 3 || carried.copperPlate > 2)) v.invalid('homestead', 'invalid return payload')
  if (['fetchWood', 'feedMill', 'takePanels', 'returnStock', 'fetchIron', 'feedIron', 'takeIron', 'takeCrates', 'feedCopper', 'feedCable', 'fetchCopper', 'takeCopper', 'fetchCable', 'takeCable'].includes(task ?? '') && elapsedMs) v.invalid('homestead', 'transport cannot hold work progress')
  if (task === 'buildChain') {
    if (!expansion.plan) v.invalid('homestead', 'missing construction plan')
    const cost = chainCost(expansion.plan.kind)
    if ((inventoryTotal(carried) && ITEMS.some(item => carried[item] !== (cost[item] ?? 0))) || ((expansion.plan.built || elapsedMs) && !inventoryTotal(carried))) v.invalid('homestead', 'invalid chain funding')
  } else if (expansion.plan) v.invalid('homestead', 'construction plan without active work')
  if (task === 'improve') {
    if (!expansion.improvement || expansion.improvements[expansion.improvement] !== undefined) v.invalid('homestead', 'invalid improvement work')
    const rule = IMPROVEMENT_RULES[expansion.improvement]
    if (inventoryTotal(carried) && (carried[rule.item] !== rule.amount || inventoryTotal(carried) !== rule.amount)) v.invalid('homestead', 'invalid improvement funding')
    if (elapsedMs && !inventoryTotal(carried)) v.invalid('homestead', 'unfunded improvement work')
  } else if (expansion.improvement) v.invalid('homestead', 'improvement without active work')
  return { store, target, task, treeBornAtMs, carried, elapsedMs, nextAtMs, millAnchor, millBuilt, expansion }
}

function restoreExpansion(value: unknown, world: World, version: number): HomesteadExpansion {
  const r = v.object(value, 'homestead.expansion', ['improvements', 'improvement', 'plan', 'forestry', 'assembler', 'furnace', ...(version >= 42 ? ['miner', 'copperFurnace', 'cableAssembler'] : [])])
  const raw = v.object(r.improvements, 'homestead.expansion.improvements', [], IMPROVEMENTS)
  const improvements = Object.fromEntries(Object.entries(raw).map(([key, tile]) => [key, v.tile(tile, `homestead.expansion.improvements.${key}`)]))
  const improvement = r.improvement === null ? null : v.choice(r.improvement, 'homestead.expansion.improvement', IMPROVEMENTS)
  const reference = (key: 'forestry' | 'assembler' | 'furnace' | 'miner' | 'copperFurnace' | 'cableAssembler') => {
    const tile = r[key] === undefined && version < 42 ? null : r[key] === null ? null : v.tile(r[key], `homestead.expansion.${key}`)
    if (tile !== null && world.buildings[tile] && world.buildings[tile]?.kind !== (key === 'forestry' ? 'forester' : key === 'copperFurnace' ? 'furnace' : key === 'cableAssembler' ? 'assembler' : key)) v.invalid(`homestead.expansion.${key}`, 'building reference disagrees')
    return tile
  }
  let plan: HomesteadExpansion['plan'] = null
  if (r.plan !== null) {
    const p = v.object(r.plan, 'homestead.expansion.plan', ['kind', 'anchor', 'direction', 'built'], version >= 42 ? ['route'] : [])
    plan = { kind: v.choice(p.kind, 'homestead.expansion.plan.kind', version >= 42 ? CHAIN_KINDS : ['forestry', 'crates', 'iron'] as const), anchor: v.tile(p.anchor, 'homestead.expansion.plan.anchor'), direction: v.direction(p.direction, 'homestead.expansion.plan.direction'), built: v.count(p.built, 'homestead.expansion.plan.built', 15) }
    if (p.route !== undefined) {
      if (plan.kind !== 'ironMining' || !Array.isArray(p.route) || p.route.length < 2 || p.route.length > 13) v.invalid('homestead.expansion.plan.route', 'invalid miner route')
      plan.route = p.route.map((tile, index) => v.tile(tile, `homestead.expansion.plan.route.${index}`))
    }
    if (plan.kind === 'ironMining') {
      const route = plan.route
      if (!route || route[0] !== plan.anchor || new Set(route).size !== route.length || route.some((tile, i) => i > 0 && Math.abs(tile % SIZE - route[i - 1] % SIZE) + Math.abs(Math.floor(tile / SIZE) - Math.floor(route[i - 1] / SIZE)) !== 1) || r.furnace === null || route[route.length - 1] !== Number(r.furnace) - 1 || world.tiles[plan.anchor] !== 'iron') v.invalid('homestead.expansion.plan.route', 'miner must connect ore to the furnace rear')
    }
    const steps = expansionLayout(plan)
    if (new Set(steps.map(s => s.tile)).size !== steps.length || plan.built >= steps.length || (plan.kind !== 'forestry' && !['north', 'south'].includes(plan.direction)) || steps.some(s => s.tile < 0 || s.tile >= SIZE * SIZE || Math.abs(s.tile % SIZE - plan!.anchor % SIZE) > (plan!.kind === 'ironMining' ? 13 : 2))) v.invalid('homestead.expansion.plan', 'invalid construction layout')
  }
  return { improvements, improvement, plan, forestry: reference('forestry'), assembler: reference('assembler'), furnace: reference('furnace'), miner: reference('miner'), copperFurnace: reference('copperFurnace'), cableAssembler: reference('cableAssembler') }
}
