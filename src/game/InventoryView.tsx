import { ITEMS, ITEM_DEFINITIONS } from '../simulation/items'
import type { Inventory } from '../simulation/items'
export function InventoryView({ inventory, expected, showAll = false, capacities }: { inventory: Readonly<Partial<Inventory>>; expected?: Readonly<Partial<Inventory>>; showAll?: boolean; capacities?: Readonly<Partial<Inventory>> }) {
  const visible = ITEMS.filter(item => showAll || (inventory[item] ?? 0) > 0 || (expected?.[item] ?? 0) > 0)
  return <>{visible.length ? visible.map(item => <div className="stats" key={item}><span>{ITEM_DEFINITIONS[item].label}</span><b>{inventory[item] ?? 0}{capacities?.[item] !== undefined && ` / ${capacities[item]}`}</b></div>) : <p className="inspection-note">Empty</p>}</>
}
export function RecipeAmounts({ amounts }: { amounts: Readonly<Partial<Inventory>> }) {
  return <>{ITEMS.filter(item => (amounts[item] ?? 0) > 0).map(item => `${amounts[item]} × ${ITEM_DEFINITIONS[item].label}`).join(' + ')}</>
}
