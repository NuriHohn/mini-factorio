import { useGameStore } from '../state/gameStore'
import { ITEM_DEFINITIONS, ITEMS, inventoryTotal } from '../simulation/items'
export function FactoryOverview() {
  const { stats, electricity, powerOverlay, togglePowerOverlay } = useGameStore()
  return <div className="factory-overview">
    <section><p className="eyebrow">STORAGE & PRODUCTION</p>
      <div className="resource"><span className="ore-icon">◆</span><div><strong>{inventoryTotal(stats.stored).toLocaleString()}</strong><p>Items in storage</p></div></div>
      <table className="resource-table" aria-label="Resource statistics"><thead><tr><th>Item</th><th>Stored</th><th>Lifetime</th></tr></thead><tbody>{ITEMS.map(item => <tr key={item}><th><span className="item-swatch" style={{ backgroundColor: `#${ITEM_DEFINITIONS[item].visual.color.toString(16).padStart(6, '0')}` }} />{ITEM_DEFINITIONS[item].label}</th><td>{stats.stored[item].toLocaleString()}</td><td>{(ITEM_DEFINITIONS[item].category === 'ore' ? stats.mined[item] : stats.produced[item]).toLocaleString()}</td></tr>)}</tbody></table>
      <p className="inspection-note">Lifetime: ore mined · products crafted</p>
      <div className="stats"><span>Mining machines</span><b>{stats.miners}</b></div>
      <div className="stats"><span>Furnaces</span><b>{stats.furnaces}</b></div>
      <div className="stats"><span>Assemblers</span><b>{stats.assemblers}</b></div>
      <div className="stats"><span>Inserters</span><b>{stats.inserters}</b></div>
      <div className="stats"><span>Maximum crafting</span><b>{stats.maxCraftingPerSec.toFixed(2)} products / sec</b></div>
      <div className="stats"><span>Maximum mining</span><b>{stats.maxMiningPerSec} ore / sec</b></div>
      <div className="stats"><span>Maximum smelting</span><b>{stats.maxSmeltingPerSec} products / sec</b></div>
    </section>
    <section className="electricity-overview" aria-label="Electricity overview"><p className="eyebrow">ELECTRICITY</p>
      <div className="stats"><span>Installed capacity</span><b>{electricity.installedKw} kW</b></div>
      <div className="stats"><span>Connected capacity</span><b>{electricity.connectedKw} kW</b></div>
      <div className="stats"><span>Requested power</span><b>{electricity.requestedKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>Supplied power</span><b>{electricity.suppliedKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>Unused capacity</span><b>{electricity.surplusKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>Unmet demand</span><b>{electricity.deficitKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>Power networks</span><b>{electricity.networks}</b></div>
      <button className={`building mt-3 ${powerOverlay ? 'overlay-enabled' : ''}`} aria-pressed={powerOverlay} onClick={togglePowerOverlay}><span><strong>Electricity overlay</strong><small>Coverage, wires and machine power</small></span><span className="key">P</span></button>
    </section>
  </div>
}
