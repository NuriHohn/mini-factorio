import { useEffect, useRef } from 'react'
import { InventoryView, RecipeAmounts } from './game/InventoryView'
import { PowerInspector } from './game/PowerInspector'
import { GameCanvas } from './game/GameCanvas'
import { useGameStore } from './state/gameStore'
import type { Tool } from './state/gameStore'
import { FURNACE_INPUT_CAPACITY, FURNACE_OUTPUT_CAPACITY, RECIPES } from './simulation/recipes'
import { ITEM_DEFINITIONS, ITEMS, inventoryTotal } from './simulation/items'
const tools: { tool: Tool; label: string; hint: string; key: string; icon: string }[] = [
  { tool: 'miner', label: 'Mining machine', hint: '1 ore / sec at full power · on ore', key: '1', icon: '⚙' },
  { tool: 'belt', label: 'Conveyor belt', hint: 'Single lane · follows arrow', key: '2', icon: '➜' },
  { tool: 'storage', label: 'Storage chest', hint: 'Stores every item type', key: '3', icon: '▣' },
  { tool: 'furnace', label: 'Furnace', hint: '1 ore → 1 plate · 2 sec at full power', key: '4', icon: '♨' },
  { tool: 'generator', label: 'Power generator', hint: '100 kW · place near a pole', key: '5', icon: '⚡' },
  { tool: 'powerPole', label: 'Power pole', hint: '3-tile coverage · 6-tile wires', key: '6', icon: '┬' },
  { tool: 'remove', label: 'Remove building', hint: 'Discards contained resources', key: 'X', icon: '×' },
]
const statuses = { processing: 'Processing', 'waiting-input': 'Waiting for ore', 'output-full': 'Output full' }
export default function App() {
  const { stats, electricity, powerOverlay, togglePowerOverlay, tool, direction, message, requestRecipe, inspected, inspection, select, rotate } = useGameStore()
  const sidebar = useRef<HTMLElement>(null)
  useEffect(() => { if (inspected !== null && sidebar.current) sidebar.current.scrollTop = 0 }, [inspected])
  return <div className="app-shell">
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3"><span className="brand-mark">M</span><div><h1>MINI FACTORIO</h1><p className="eyebrow">A small beginning. An industrial future.</p></div></div>
      <span className="version"><i /> COPPER / SPRINT 05</span>
    </header>
    <main>
      <aside ref={sidebar} className="flex flex-col gap-7 p-6">
        {inspection && <section className="inspection" aria-label="Building inspection">
          <p className="eyebrow">{inspection.kind === 'powerPole' ? 'POWER POLE' : inspection.kind.toUpperCase()} INSPECTION</p>
          {inspection.kind !== 'storage' && <PowerInspector details={inspection.electrical} />}
          {inspection.kind === 'storage' ? <InventoryView inventory={inspection.inventory} showAll /> : inspection.kind === 'furnace' ? <>
            <h2>Furnace</h2>
            <div className="stats"><span>Detected recipe</span><b>{inspection.recipe}</b></div>
            <label className="recipe-label" htmlFor="furnace-recipe">Recipe mode</label>
            <select id="furnace-recipe" value={inspection.recipeMode} disabled={inspection.recipeChangeError !== null} aria-describedby="recipe-help" onChange={event => {
              if (event.currentTarget.value === 'auto') { requestRecipe('auto'); return }
              const recipe = Object.values(RECIPES).find(recipe => recipe.id === event.currentTarget.value)
              if (recipe) requestRecipe(recipe.id)
            }}><option value="auto">Auto</option>{Object.values(RECIPES).filter(recipe => recipe.machine === 'furnace').map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}</select>
            <p className="inspection-note" id="recipe-help">{inspection.recipeChangeError ?? 'Auto detects incoming ore and stays locked until both buffers and the active batch are empty. Change mode only while empty and idle.'}</p>
            {inspection.recipeId && <p className="inspection-recipe"><RecipeAmounts amounts={inspection.requirements} /> → <RecipeAmounts amounts={inspection.products} /> · {inspection.durationMs / 1000} seconds at full power · No fuel needed</p>}
            <div className="stats"><span>Status</span><b>{inspection.status === 'processing' && inspection.electrical.speedFraction === 0 ? 'Paused · no power' : statuses[inspection.status]}</b></div>
            <div className="stats"><span>Output direction</span><b>{inspection.direction}</b></div>
            <section aria-label="Input inventory"><div className="stats"><span>Input buffer</span><b>{inventoryTotal(inspection.input)} / {FURNACE_INPUT_CAPACITY}</b></div><InventoryView inventory={inspection.input} expected={inspection.requirements} /></section>
            <section aria-label="Output inventory"><div className="stats"><span>Output buffer</span><b>{inventoryTotal(inspection.output)} / {FURNACE_OUTPUT_CAPACITY}</b></div><InventoryView inventory={inspection.output} expected={inspection.products} /></section>
            <div className="stats"><span>Reserved output slots</span><b>{inventoryTotal(inspection.reserved)}</b></div>
            <div className="stats"><span>Processing progress</span><b>{Math.round(inspection.progress * 100)}%</b></div>
            <progress aria-label="Smelting progress" value={inspection.progress} max={1} />
            {inspection.status === 'processing' && <p className="inspection-note">Recipe ingredients committed to this batch.</p>}
            {inspection.outputWaiting && <p className="inspection-warning" role="status">Output waiting for conveyor</p>}
          </> : inspection.kind === 'miner' ? <>
            <div className="stats"><span>Extracting</span><b>{inspection.resource ? ITEM_DEFINITIONS[inspection.resource].label : 'No deposit'}</b></div>
            <div className="stats"><span>Mining progress</span><b>{Math.round(inspection.progress * 100)}%</b></div>
            <div className="stats"><span>Output buffer</span><b>{inspection.buffered ? '1 ore · blocked' : 'Empty'}</b></div>
          </> : inspection.kind === 'generator' ? <>
            <div className="stats"><span>Generation capacity</span><b>{inspection.capacityKw} kW</b></div>
            <div className="stats"><span>Actual generation</span><b>{inspection.actualKw.toFixed(1)} kW</b></div>
            <p className="inspection-note">No fuel needed. Requires a pole within 3 tiles.</p>
          </> : <>
            <div className="stats"><span>Coverage radius</span><b>{inspection.coverageRadius} tiles</b></div>
            <div className="stats"><span>Machines in radius</span><b>{inspection.coveredMachines}</b></div>
            <p className="inspection-note">Highlighted machines are in this pole’s radius. Amber highlights belong to another network.</p>
          </>}
        </section>}
        <section><p className="eyebrow">STORAGE & PRODUCTION</p>
          <div className="resource"><span className="ore-icon">◆</span><div><strong>{inventoryTotal(stats.stored).toLocaleString()}</strong><p>Items in storage</p></div></div>
          <table className="resource-table" aria-label="Resource statistics"><thead><tr><th>Item</th><th>Stored</th><th>Lifetime</th></tr></thead><tbody>{ITEMS.map(item => <tr key={item}><th><span className="item-swatch" style={{ backgroundColor: `#${ITEM_DEFINITIONS[item].visual.color.toString(16).padStart(6, '0')}` }} />{ITEM_DEFINITIONS[item].label}</th><td>{stats.stored[item].toLocaleString()}</td><td>{(ITEM_DEFINITIONS[item].category === 'ore' ? stats.mined[item] : stats.produced[item]).toLocaleString()}</td></tr>)}</tbody></table>
          <p className="inspection-note">Lifetime: ore mined · plates produced</p>
          <div className="stats"><span>Mining machines</span><b>{stats.miners}</b></div>
          <div className="stats"><span>Furnaces</span><b>{stats.furnaces}</b></div>
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
          <button className={`building mt-3 ${powerOverlay ? 'selected' : ''}`} aria-pressed={powerOverlay} onClick={togglePowerOverlay}><span><strong>Electricity overlay</strong><small>Coverage, wires and machine power</small></span><span className="key">P</span></button>
        </section>
        <section><p className="eyebrow mb-3">BUILDINGS · FREE TO BUILD</p>
          <div className="flex flex-col gap-2">{tools.map(option => <button key={option.key} className={`building ${tool === option.tool ? 'selected' : ''}`} onClick={() => select(tool === option.tool ? null : option.tool)} aria-pressed={tool === option.tool}><span className="machine-icon">{option.icon}</span><span><strong>{option.label}</strong><small>{option.hint}</small></span><span className="key">{option.key}</span></button>)}</div>
          <button className="building mt-3" onClick={rotate} disabled={tool !== 'miner' && tool !== 'belt' && tool !== 'furnace'}><span><strong>Output: {direction}</strong><small>Remove and replace to redirect buildings</small></span><span className="key">R</span></button>
        </section>
        <section className="mission"><p className="eyebrow">POWER YOUR FACTORY</p><h2>Generate. Connect. Produce.</h2><p>Place a generator (5) and a pole (6). Machines need a pole within 3 tiles; poles connect within 6 tiles. Shortages slow all working machines proportionally. Belts always run. Select copper smelting in an empty furnace’s inspector before feeding copper ore.</p></section>
        <div className="controls"><p className="eyebrow mb-3">FIELD MANUAL</p><p><kbd>W A S D</kbd><span>Move camera</span></p><p><kbd>SCROLL</kbd><span>Zoom in / out</span></p><p><kbd>1–6</kbd><span>Choose building</span></p><p><kbd>R / X</kbd><span>Rotate / remove</span></p><p><kbd>P</kbd><span>Electricity overlay</span></p><p><kbd>ESC</kbd><span>Cancel / inspect</span></p></div>
        <p className="session-note">Session only · Refresh to start a new world</p>
      </aside>
      <section className="world-panel"><div className="world-heading"><span><i /> GRASSLAND / SECTOR 01</span><span>40 × 40 TILES</span></div><GameCanvas /><div className="world-footer"><span role="status">{message}</span><span className="legend">{powerOverlay ? 'Green full · Amber reduced · Red no power · Blue idle' : <>◆ Iron · <span className="copper-legend">◆ Copper</span></>}</span></div></section>
    </main>
  </div>
}
