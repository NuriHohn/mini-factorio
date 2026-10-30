import { ITEMS, ITEM_DEFINITIONS, inventoryTotal } from '../simulation/items'
import type { Inspection } from '../simulation/inspection'
import { PROJECT_NAMES } from '../simulation/peteStatus'
import { useGameText } from './useGameText'
import { RecipeAmounts } from './InventoryView'
const ICONS: Record<string, string> = { wood: '🪵', woodPanel: '▤', woodenCrate: '📦', iron: '◆', ironPlate: '▰', ironGear: '⚙', copper: '🔸', copperPlate: '▰', copperCable: '〰', electronicCircuit: '▣', coal: '⬟', coalBriquette: '▦', mechanicModule: '⚙' }
export function MaterialStore({ store }: { store: Extract<Inspection, { kind: 'supplyCrate' }> }) {
  const t = useGameText(), demand = store.demand
  const total = store.wood + inventoryTotal(store.inventory)
  return <section className="material-store" aria-label="Materiallager">
    <div className="store-capacity"><strong>📦 {total} / {store.capacity}</strong><span>Plätze belegt</span></div>
    <progress aria-label="Lagerbelegung" max={store.capacity} value={total} />
    {demand && <div className="store-goal"><strong>🎯 {t(PROJECT_NAMES[demand.id])}</strong><p>{demand.paid ? 'Baumaterial bereits entnommen' : 'Noch sammeln:'} {!demand.paid && (Object.values(demand.missing).some(n => n! > 0) ? <RecipeAmounts amounts={demand.missing} /> : '✓ Material vollständig')}</p></div>}
    <div className="material-grid">{ITEMS.filter(item => (item === 'wood' ? store.wood : store.inventory[item]) > 0 || (demand?.costs[item] ?? 0) > 0).map(item => {
      const count = item === 'wood' ? store.wood : store.inventory[item], reserved = demand?.reserved[item] ?? 0
      return <div className="material-tile" key={item}><span className="material-icon" aria-hidden="true" style={{ color: `#${ITEM_DEFINITIONS[item].visual.highlight.toString(16).padStart(6, '0')}` }}>{ICONS[item] ?? '▪'}</span><strong>{count}</strong><span>{t(ITEM_DEFINITIONS[item].label)}</span>{reserved > 0 && <small>🎯 {reserved} vorgemerkt</small>}</div>
    })}</div>
    {total === 0 && !demand && <p>Lager leer · Pete sammelt Nachschub</p>}
    {demand && !demand.paid && <small>Vorgemerkt = Wunschbedarf. Entnahme erst beim Baustart.</small>}
  </section>
}
