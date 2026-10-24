import { HOME_TASKS } from '../simulation/homestead'
import type { Homestead } from '../simulation/homestead'
import { ITEMS, inventoryTotal } from '../simulation/items'
import { MATURE_TREE_MS } from '../simulation/nature'
import type { World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import * as v from './validation'

export function restoreHomestead(value: unknown, world: World): Homestead {
  if (!world.miniFactory || world.peace.home === null) v.invalid('homestead', 'requires Petes Welt and a home')
  const r = v.object(value, 'homestead', ['store', 'task', 'target', 'treeBornAtMs', 'carried', 'elapsedMs', 'nextAtMs', 'millAnchor', 'millBuilt'])
  const nullableTile = (key: string) => r[key] === null ? null : v.tile(r[key], `homestead.${key}`)
  const store = nullableTile('store'), target = nullableTile('target'), millAnchor = nullableTile('millAnchor')
  const task = r.task === null ? null : v.choice(r.task, 'homestead.task', HOME_TASKS)
  const carried = v.inventory(r.carried, 'homestead.carried'), elapsedMs = v.count(r.elapsedMs, 'homestead.elapsedMs', task === 'expandStore' ? 8000 : task === 'buildMill' ? 4000 : 6000)
  const nextAtMs = v.count(r.nextAtMs, 'homestead.nextAtMs', world.timeMs + 10000), millBuilt = v.count(r.millBuilt, 'homestead.millBuilt', 3)
  const treeBornAtMs = r.treeBornAtMs === null ? null : v.number(r.treeBornAtMs, 'homestead.treeBornAtMs', -MATURE_TREE_MS, world.timeMs - MATURE_TREE_MS, true)
  if (elapsedMs % 50 || nextAtMs % 50 || (treeBornAtMs !== null && treeBornAtMs % 50) || ITEMS.some(i => i !== 'wood' && i !== 'woodPanel' && carried[i]) || carried.wood > 12 || carried.woodPanel > 8 || (carried.wood && carried.woodPanel)) v.invalid('homestead', 'invalid carried stock or clock')
  if (task === null && (elapsedMs || target !== null || treeBornAtMs !== null || inventoryTotal(carried))) v.invalid('homestead', 'idle routine contains committed work')
  if (task !== null && task !== 'gather' && target === null) v.invalid('homestead.target', 'committed work needs a target')
  if ((task !== 'gather' && treeBornAtMs !== null) || (task === 'gather' && (target === null) !== (treeBornAtMs === null))) v.invalid('homestead', 'invalid harvest identity')
  if (store !== null && world.buildings[store] && (world.buildings[store]?.kind !== 'supplyCrate' || world.buildings[store].storeTier === undefined)) v.invalid('homestead.store', 'material store reference disagrees')
  if ((millAnchor === null && millBuilt) || (millAnchor !== null && (millAnchor % SIZE >= SIZE - 1 || Math.floor(millAnchor / SIZE) >= SIZE - 1))) v.invalid('homestead.millAnchor', 'invalid mill layout')
  if (task === 'buildStore' && (store !== null || carried.wood < 6)) v.invalid('homestead', 'store requires paid construction Wood')
  if (task === 'gather' && (carried.wood > 6 || carried.wood % 3 || carried.woodPanel)) v.invalid('homestead', 'invalid starter harvest load')
  if ((task === 'fetchWood' || task === 'takePanels') && inventoryTotal(carried)) v.invalid('homestead', 'uncollected pickup contains material')
  if (task === 'buildMill' && (![0, 12].includes(carried.wood) || carried.woodPanel || (millBuilt > 0 && carried.wood !== 12))) v.invalid('homestead', 'invalid paid mill construction')
  if (task === 'expandStore' && (target !== store || carried.wood || (elapsedMs > 0 && carried.woodPanel !== 8))) v.invalid('homestead', 'extension work is not funded')
  if (task === 'buildMill' && millAnchor === null) v.invalid('homestead', 'mill construction needs a plan')
  if (task === 'feedMill' && (!carried.wood || target !== millAnchor)) v.invalid('homestead', 'missing mill delivery')
  if (task === 'returnStock' && (!inventoryTotal(carried) || target !== store)) v.invalid('homestead', 'missing return payload')
  if (task === 'expandStore' && carried.woodPanel !== 0 && carried.woodPanel !== 8) v.invalid('homestead', 'invalid paid extension')
  return { store, target, task, treeBornAtMs, carried, elapsedMs, nextAtMs, millAnchor, millBuilt }
}
