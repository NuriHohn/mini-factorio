import { useGameText } from './useGameText'
import { ITEMS, ITEM_DEFINITIONS } from '../simulation/items'
import type { Inventory } from '../simulation/items'
export function InventoryView({ inventory, expected, showAll = false, capacities }: { inventory: Readonly<Partial<Inventory>>; expected?: Readonly<Partial<Inventory>>; showAll?: boolean; capacities?: Readonly<Partial<Inventory>> }) {
  const t = useGameText()
  const visible = ITEMS.filter(item => showAll || (inventory[item] ?? 0) > 0 || (expected?.[item] ?? 0) > 0)
  return <>{visible.length ? visible.map(item => <div className="stats" key={item}><span>{t(ITEM_DEFINITIONS[item].label)}</span><b>{inventory[item] ?? 0}{capacities?.[item] !== undefined && ` / ${capacities[item]}`}</b></div>) : <p className="inspection-note">{t('Empty')}</p>}</>
}
export function RecipeAmounts({ amounts }: { amounts: Readonly<Partial<Inventory>> }) {
  const t = useGameText()
  return <>{ITEMS.filter(item => (amounts[item] ?? 0) > 0).map(item => `${amounts[item]} × ${t(ITEM_DEFINITIONS[item].label)}`).join(' + ')}</>
}
